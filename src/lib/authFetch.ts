import { headers } from "next/headers";

import { getAuthSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/token-refresh";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Derive the app origin from the incoming request headers.
 * Works in Server Components and Route Handlers without extra env vars.
 */
async function getOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${proto}://${host}`;
}

/**
 * Fetch wrapper for server-side use (Server Components and Route Handlers).
 *
 * Attaches the stored access token as a Bearer header. On a 401 response it
 * silently refreshes the token via the mock IdP, persists the new session, and
 * retries the original request once. A second 401 throws AuthError.
 *
 * Note: session persistence after a refresh requires a write-capable cookie
 * context (Route Handlers, Server Functions). In Server Components the updated
 * token is still used for the retry within the current request cycle, but the
 * new session cookie cannot be set during rendering — the proxy handles
 * proactive refresh for that case.
 */
export async function authFetch(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getAuthSession();

  if (!session.accessToken || !session.refreshToken) {
    throw new AuthError("No active session found");
  }

  const withBearer = (token: string): RequestInit => ({
    ...options,
    headers: {
      ...options.headers,
      authorization: `Bearer ${token}`,
    },
  });

  const firstRes = await fetch(url, withBearer(session.accessToken));

  if (firstRes.status !== 401) {
    return firstRes;
  }

  // Access token was rejected — try to get a fresh one.
  const origin = await getOrigin();
  const refreshedSession = await refreshAccessToken(
    origin,
    session.refreshToken
  ).catch(() => {
    throw new AuthError("Token refresh failed — please sign in again");
  });

  // Persist the new session (works in Route Handlers / Server Functions).
  session.accessToken = refreshedSession.accessToken;
  session.refreshToken = refreshedSession.refreshToken;
  session.expiresAt = refreshedSession.expiresAt;
  await session.save();

  // Retry the original request with the refreshed token.
  const retryRes = await fetch(url, withBearer(refreshedSession.accessToken));

  if (retryRes.status === 401) {
    throw new AuthError("Authentication failed after token refresh");
  }

  return retryRes;
}
