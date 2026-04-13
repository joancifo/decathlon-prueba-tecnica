import { AUTH_CLIENT_ID } from "@/lib/auth-client";

type RefreshResponsePayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export async function refreshAccessToken(
  origin: string,
  refreshToken: string
): Promise<RefreshedSession> {
  const tokenResponse = await fetch(`${origin}/api/idp/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: AUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token refresh failed with status ${tokenResponse.status}`);
  }

  const tokens = (await tokenResponse.json()) as RefreshResponsePayload;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}
