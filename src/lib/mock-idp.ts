import { randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 600;
const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEMO_USER = {
  sub: "demo-user",
  email: "demo@test.com",
  name: "Demo User",
};
const DEMO_PASSWORD = "password123";
const IDP_ISSUER = "mock-next-idp";

type IdpUser = typeof DEMO_USER;

type AuthorizationCodeRecord = {
  clientId: string;
  redirectUri: string;
  user: IdpUser;
  expiresAt: number;
};

type RefreshTokenRecord = {
  clientId: string;
  user: IdpUser;
  expiresAt: number;
};

type MockIdpStore = {
  authorizationCodes: Map<string, AuthorizationCodeRecord>;
  refreshTokens: Map<string, RefreshTokenRecord>;
};

const globalForMockIdp = globalThis as typeof globalThis & {
  mockIdpStore?: MockIdpStore;
};

const mockIdpStore =
  globalForMockIdp.mockIdpStore ??
  {
    authorizationCodes: new Map<string, AuthorizationCodeRecord>(),
    refreshTokens: new Map<string, RefreshTokenRecord>(),
  };

globalForMockIdp.mockIdpStore = mockIdpStore;

function getJwtSecret() {
  const secret = process.env.IDP_JWT_SECRET;

  if (!secret) {
    throw new Error("Missing IDP_JWT_SECRET in .env.local");
  }

  return new TextEncoder().encode(secret);
}

function cleanupExpiredEntries(now = Date.now()) {
  for (const [code, record] of mockIdpStore.authorizationCodes.entries()) {
    if (record.expiresAt <= now) {
      mockIdpStore.authorizationCodes.delete(code);
    }
  }

  for (const [token, record] of mockIdpStore.refreshTokens.entries()) {
    if (record.expiresAt <= now) {
      mockIdpStore.refreshTokens.delete(token);
    }
  }
}

export function validateDemoCredentials(email: string, password: string) {
  return email === DEMO_USER.email && password === DEMO_PASSWORD;
}

export function getDemoUser() {
  return DEMO_USER;
}

export function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
}) {
  cleanupExpiredEntries();

  const code = randomUUID();

  mockIdpStore.authorizationCodes.set(code, {
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    user: DEMO_USER,
    expiresAt: Date.now() + AUTHORIZATION_CODE_TTL_MS,
  });

  return code;
}

export function consumeAuthorizationCode(input: {
  code: string;
  clientId?: string | null;
  redirectUri?: string | null;
}) {
  cleanupExpiredEntries();

  const record = mockIdpStore.authorizationCodes.get(input.code);
  mockIdpStore.authorizationCodes.delete(input.code);

  if (!record) {
    return null;
  }

  if (input.clientId && record.clientId !== input.clientId) {
    return null;
  }

  if (input.redirectUri && record.redirectUri !== input.redirectUri) {
    return null;
  }

  return record;
}

export function createRefreshToken(input: {
  clientId: string;
  user: IdpUser;
}) {
  cleanupExpiredEntries();

  const refreshToken = randomUUID();

  mockIdpStore.refreshTokens.set(refreshToken, {
    clientId: input.clientId,
    user: input.user,
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
  });

  return refreshToken;
}

export function getRefreshTokenRecord(refreshToken: string) {
  cleanupExpiredEntries();

  return mockIdpStore.refreshTokens.get(refreshToken) ?? null;
}

export function invalidateRefreshToken(refreshToken: string) {
  return mockIdpStore.refreshTokens.delete(refreshToken);
}

export function invalidateRefreshTokensForSub(sub: string) {
  cleanupExpiredEntries();

  let revokedCount = 0;

  for (const [token, record] of mockIdpStore.refreshTokens.entries()) {
    if (record.user.sub === sub) {
      mockIdpStore.refreshTokens.delete(token);
      revokedCount += 1;
    }
  }

  return revokedCount;
}

export function resetMockIdpStore() {
  mockIdpStore.authorizationCodes.clear();
  mockIdpStore.refreshTokens.clear();
}

export async function createAccessToken(user: IdpUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuer(IDP_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    issuer: IDP_ISSUER,
    algorithms: ["HS256"],
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.name !== "string"
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}

export function buildTokenResponse(input: {
  accessToken: string;
  refreshToken: string;
}) {
  return {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    token_type: "Bearer",
  };
}

export function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim() || null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildAuthorizePage(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  responseType: string;
  errorMessage?: string;
}) {
  const errorMarkup = input.errorMessage
    ? `<p style="margin:0 0 16px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;">${escapeHtml(
        input.errorMessage
      )}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock identity provider</title>
  </head>
  <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;color:#18181b;">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <section style="width:100%;max-width:420px;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 20px 45px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 8px;font-size:28px;">Mock identity provider</h1>
        <p style="margin:0 0 24px;color:#52525b;">Inicia sesion con el usuario de demo para emitir un authorization code.</p>
        ${errorMarkup}
        <form method="post">
          <input type="hidden" name="client_id" value="${escapeHtml(input.clientId)}" />
          <input type="hidden" name="redirect_uri" value="${escapeHtml(input.redirectUri)}" />
          <input type="hidden" name="state" value="${escapeHtml(input.state)}" />
          <input type="hidden" name="response_type" value="${escapeHtml(input.responseType)}" />

          <label for="email" style="display:block;margin-bottom:8px;font-size:14px;font-weight:700;">Email</label>
          <input id="email" name="email" type="email" value="${escapeHtml(
            DEMO_USER.email
          )}" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d4d4d8;border-radius:10px;margin-bottom:16px;" />

          <label for="password" style="display:block;margin-bottom:8px;font-size:14px;font-weight:700;">Password</label>
          <input id="password" name="password" type="password" value="${escapeHtml(
            DEMO_PASSWORD
          )}" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #d4d4d8;border-radius:10px;margin-bottom:20px;" />

          <button type="submit" style="width:100%;border:0;border-radius:10px;background:#18181b;color:#ffffff;padding:12px 16px;font-weight:700;cursor:pointer;">
            Continuar
          </button>
        </form>

        <div style="margin-top:20px;padding:14px;border-radius:10px;background:#f5f5f5;font-size:14px;line-height:1.5;">
          <div><strong>User:</strong> ${escapeHtml(DEMO_USER.email)}</div>
          <div><strong>Pass:</strong> ${escapeHtml(DEMO_PASSWORD)}</div>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export function parseRedirectUri(redirectUri: string) {
  return new URL(redirectUri);
}
