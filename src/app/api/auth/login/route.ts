import { randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { AUTH_CLIENT_ID } from "@/lib/auth-client";
import { getAuthSessionForRequest } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const state = randomUUID();
  const redirectUri = new URL("/api/auth/callback", request.nextUrl.origin).toString();
  const authorizeUrl = new URL("/api/idp/authorize", request.nextUrl.origin);

  authorizeUrl.searchParams.set("client_id", AUTH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  console.log("[AuthLogin] Generating state:", state);

  const response = NextResponse.redirect(authorizeUrl, 307);

  response.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("pragma", "no-cache");
  response.headers.set("expires", "0");

  const session = await getAuthSessionForRequest(request, response);

  session.oauthState = state;
  await session.save();

  return response;
}
