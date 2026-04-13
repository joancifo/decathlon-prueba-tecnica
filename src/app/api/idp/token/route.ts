import { type NextRequest } from "next/server";

import {
  buildTokenResponse,
  consumeAuthorizationCode,
  createAccessToken,
  createRefreshToken,
  getRefreshTokenRecord,
} from "@/lib/mock-idp";
import { readRequestBodyAsMap } from "@/lib/request-body";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsonError(error: string, errorDescription: string, status: number) {
  return Response.json(
    {
      error,
      error_description: errorDescription,
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await readRequestBodyAsMap(request);
    const grantType = body.get("grant_type");

    if (grantType === "authorization_code") {
      const code = body.get("code");
      const clientId = body.get("client_id");
      const redirectUri = body.get("redirect_uri");

      if (!code) {
        return jsonError("invalid_request", "code es obligatorio.", 400);
      }

      const authorizationCode = consumeAuthorizationCode({
        code,
        clientId,
        redirectUri,
      });

      if (!authorizationCode) {
        return jsonError(
          "invalid_grant",
          "El authorization code no es valido o ya expiro.",
          400
        );
      }

      const accessToken = await createAccessToken(authorizationCode.user);
      const refreshToken = createRefreshToken({
        clientId: authorizationCode.clientId,
        user: authorizationCode.user,
      });

      return Response.json(buildTokenResponse({ accessToken, refreshToken }), {
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.get("refresh_token");
      const clientId = body.get("client_id");

      if (!refreshToken || !clientId) {
        return jsonError(
          "invalid_request",
          "refresh_token y client_id son obligatorios.",
          400
        );
      }

      const refreshTokenRecord = getRefreshTokenRecord(refreshToken);

      if (!refreshTokenRecord) {
        return jsonError(
          "invalid_grant",
          "El refresh token no es valido o ya expiro.",
          400
        );
      }

      if (refreshTokenRecord.clientId !== clientId) {
        return jsonError(
          "invalid_grant",
          "El refresh token no pertenece al client_id indicado.",
          400
        );
      }

      const accessToken = await createAccessToken(refreshTokenRecord.user);

      return Response.json(buildTokenResponse({ accessToken, refreshToken }), {
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    return jsonError(
      "unsupported_grant_type",
      "grant_type debe ser authorization_code o refresh_token.",
      400
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo emitir el token.";

    return jsonError("server_error", message, 500);
  }
}
