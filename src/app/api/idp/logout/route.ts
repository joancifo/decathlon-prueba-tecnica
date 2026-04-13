import { type NextRequest } from "next/server";

import {
  extractBearerToken,
  invalidateRefreshToken,
  invalidateRefreshTokensForSub,
  verifyAccessToken,
} from "@/lib/mock-idp";
import { readRequestBodyAsMap } from "@/lib/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let revokedTokens = 0;

  try {
    const body = await readRequestBodyAsMap(request);
    const refreshToken = body.get("refresh_token") ?? null;
    const accessToken = extractBearerToken(
      request.headers.get("authorization")
    );

    if (refreshToken && invalidateRefreshToken(refreshToken)) {
      revokedTokens += 1;
    }

    if (accessToken) {
      const user = await verifyAccessToken(accessToken);
      revokedTokens += invalidateRefreshTokensForSub(user.sub);
    }

    return Response.json(
      {
        success: true,
        revoked_tokens: revokedTokens,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch {
    return Response.json(
      {
        error: "invalid_request",
        error_description:
          "No se pudo procesar el logout. Revisa el Bearer token o refresh_token.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
}
