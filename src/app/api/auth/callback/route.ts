import { type NextRequest, NextResponse } from "next/server";

import { AUTH_CLIENT_ID } from "@/lib/auth-client";
import { getAuthSessionForRequest, saveAuthSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isBrowserNavigation(request: NextRequest) {
  const mode = request.headers.get("sec-fetch-mode");
  const destination = request.headers.get("sec-fetch-dest");

  return mode === "navigate" || destination === "document";
}

function buildAuthErrorUrl(request: NextRequest, reason: string) {
  const errorUrl = new URL("/auth/error", request.nextUrl.origin);
  errorUrl.searchParams.set("reason", reason);
  return errorUrl;
}

async function clearPendingOAuthState(request: NextRequest, response: NextResponse) {
  response.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("pragma", "no-cache");
  response.headers.set("expires", "0");
  const session = await getAuthSessionForRequest(request, response);

  delete session.oauthState;
  await session.save();
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const sessionProbe = await getAuthSessionForRequest(request, new Response());
  const storedState = sessionProbe.oauthState;
  const isNavigationRequest = isBrowserNavigation(request);

  if (!code || !state || !storedState || state !== storedState) {
    const response = isNavigationRequest
      ? NextResponse.redirect(buildAuthErrorUrl(request, "invalid_state"), 307)
      : NextResponse.json(
          {
            error: "invalid_state",
            error_description: "El state recibido no coincide con la cookie temporal.",
          },
          {
            status: 400,
          }
        );

    await clearPendingOAuthState(request, response);

    return response;
  }

  const tokenResponse = await fetch(new URL("/api/idp/token", request.nextUrl.origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: AUTH_CLIENT_ID,
      redirect_uri: new URL("/api/auth/callback", request.nextUrl.origin).toString(),
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const errorPayload = (await tokenResponse.json()) as Record<string, unknown>;
    const response = isNavigationRequest
      ? NextResponse.redirect(buildAuthErrorUrl(request, "token_exchange_failed"), 307)
      : NextResponse.json(errorPayload, {
          status: tokenResponse.status,
        });

    await clearPendingOAuthState(request, response);

    return response;
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const response = NextResponse.redirect(new URL("/app/dashboard", request.nextUrl.origin));

  await saveAuthSession(request, response, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  return response;
}
