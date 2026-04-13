import { randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";
import {
  validateDemoCredentials,
  getDemoUser,
  createAccessToken,
  createRefreshToken,
  buildTokenResponse,
} from "@/lib/mock-idp";
import { saveAuthSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const AUTH_CLIENT_ID = "nextjs-server-app";

const AUTH_STATE_COOKIE_NAME = "decathlon_oauth_state";

export async function GET(request: NextRequest) {
  const state = randomUUID();
  const redirectUri = new URL("/api/auth/callback", request.nextUrl.origin).toString();
  const authorizeUrl = new URL("/api/idp/authorize", request.nextUrl.origin);

  authorizeUrl.searchParams.set("client_id", AUTH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(authorizeUrl, 307);

  response.headers.set("cache-control", "no-store");
  response.cookies.set(AUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !validateDemoCredentials(email, password)
  ) {
    return NextResponse.redirect(new URL("/?error=invalid_credentials", request.nextUrl.origin));
  }

  const user = getDemoUser();
  const accessToken = await createAccessToken(user);
  const refreshToken = createRefreshToken({
    clientId: AUTH_CLIENT_ID,
    user,
  });

  const tokenResponse = buildTokenResponse({
    accessToken,
    refreshToken,
  });

  const response = NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));

  await saveAuthSession(request, response, {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  });

  return response;
}
