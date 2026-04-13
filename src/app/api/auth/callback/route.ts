import { type NextRequest, NextResponse } from "next/server";
import { saveAuthSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUTH_CLIENT_ID = "nextjs-server-app";
const AUTH_STATE_COOKIE_NAME = "decathlon_oauth_state";

function clearStateCookie(response: NextResponse) {
  response.headers.set("cache-control", "no-store");
  response.cookies.set(AUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(AUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    const response = NextResponse.json(
      {
        error: "invalid_state",
        error_description: "El state recibido no coincide con la cookie temporal.",
      },
      {
        status: 400,
      }
    );

    clearStateCookie(response);

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

    const response = NextResponse.json(errorPayload, {
      status: tokenResponse.status,
    });

    clearStateCookie(response);

    return response;
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const response = NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));

  clearStateCookie(response);

  await saveAuthSession(request, response, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  return response;
}
