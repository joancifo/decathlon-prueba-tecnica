import { type NextRequest, NextResponse } from "next/server";

import { destroyAuthSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl.origin));
  response.headers.set("cache-control", "no-store");
  const session = await destroyAuthSession(request, response);

  if (session) {
    try {
      await fetch(new URL("/api/idp/logout", request.nextUrl.origin), {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: session.refreshToken,
        }),
        cache: "no-store",
      });
    } catch {
      // Logout should always clear the local session, even if the mock IdP fails.
    }
  }

  return response;
}
