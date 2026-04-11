import { type NextRequest } from "next/server";

import { extractBearerToken, verifyAccessToken } from "@/lib/mock-idp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const accessToken = extractBearerToken(
      request.headers.get("authorization")
    );

    if (!accessToken) {
      return Response.json(
        {
          error: "missing_token",
          error_description: "Falta un Bearer token en Authorization.",
        },
        {
          status: 401,
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    const user = await verifyAccessToken(accessToken);

    return Response.json(user, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        error: "invalid_token",
        error_description: "El access token no es valido o ha expirado.",
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
}
