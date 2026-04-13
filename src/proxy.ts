import { type NextRequest, NextResponse } from "next/server";

import { getAuthSessionForRequest, readStoredAuthSession } from "@/lib/session";
import { refreshAccessToken } from "@/lib/token-refresh";

// Proactively refresh when less than 2 minutes remain on the access token.
const REFRESH_THRESHOLD_MS = 2 * 60 * 1000;
const SESSION_COOKIE_NAME = "decathlon_auth_session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getAuthSessionForRequest(request, response);
  const stored = readStoredAuthSession(session);

  if (!stored) {
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  const msLeft = stored.expiresAt - Date.now();

  if (msLeft >= REFRESH_THRESHOLD_MS) {
    return response;
  }

  // Token is about to expire — refresh before continuing.
  try {
    const refreshedSession = await refreshAccessToken(
      request.nextUrl.origin,
      stored.refreshToken
    );

    session.accessToken = refreshedSession.accessToken;
    session.refreshToken = refreshedSession.refreshToken;
    session.expiresAt = refreshedSession.expiresAt;
    await session.save();

    return response;
  } catch {
    // Refresh failed — clear session and force re-login.
    const redirect = NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    );
    redirect.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return redirect;
  }
}

export const config = {
  matcher: [
    /*
     * Protect every path except:
     *   /              — public landing page (no chars after the leading slash)
     *   /api/auth/**   — auth flow handlers
     *   /api/idp/**    — mock IdP handlers
     *   /_next/**      — Next.js internals + static assets
     *   /favicon.ico   — browser icon
     */
    "/((?!api/auth|api/idp|_next|favicon\\.ico$).+)",
  ],
};
