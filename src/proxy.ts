import { type NextRequest, NextResponse } from "next/server";

import { getAuthSessionForRequest, readStoredAuthSession } from "@/lib/session";

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
    const tokenRes = await fetch(new URL("/api/idp/token", request.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      throw new Error(`IdP returned ${tokenRes.status}`);
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.expiresAt = Date.now() + tokens.expires_in * 1000;
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
