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
    ? `<div style="margin-bottom:20px;padding:12px 16px;background-color:#fef2f2;border:1px solid #fee2e2;border-radius:12px;color:#991b1b;font-size:14px;display:flex;align-items:center;gap:8px;">
        <svg style="width:16px;height:16px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>${escapeHtml(input.errorMessage)}</span>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Iniciar sesión</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; color: #111827; -webkit-font-smoothing: antialiased; }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .card { width: 100%; max-width: 420px; background: #ffffff; border-radius: 20px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #f3f4f6; }
      h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; text-align: center; }
      .subtitle { margin: 0 0 32px; color: #4b5563; font-size: 15px; text-align: center; }
      label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: #374151; }
      input { width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; transition: all 0.2s; background: #f9fafb; margin-bottom: 20px; }
      input:focus { outline: none; border-color: #2563eb; background: #ffffff; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
      button { width: 100%; padding: 14px; background: #111827; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
      button:hover { background: #1f2937; transform: translateY(-1px); }
      .helper { margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 10px; font-size: 13px; color: #4b5563; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>Iniciar sesión</h1>
        <p class="subtitle">Introduce tus credenciales para continuar</p>
        
        ${errorMarkup}
        
        <form method="post">
          <input type="hidden" name="client_id" value="${escapeHtml(input.clientId)}" />
          <input type="hidden" name="redirect_uri" value="${escapeHtml(input.redirectUri)}" />
          <input type="hidden" name="state" value="${escapeHtml(input.state)}" />
          <input type="hidden" name="response_type" value="${escapeHtml(input.responseType)}" />

          <label for="email">Correo electrónico</label>
          <input id="email" name="email" type="email" value="${escapeHtml(DEMO_USER.email)}" required />

          <label for="password">Contraseña</label>
          <input id="password" name="password" type="password" value="${escapeHtml(DEMO_PASSWORD)}" required />

          <button type="submit">Acceder</button>
        </form>

        <div class="helper">
          <div><strong>Credenciales demo:</strong></div>
          <div>Email: ${escapeHtml(DEMO_USER.email)}</div>
          <div>Password: ${escapeHtml(DEMO_PASSWORD)}</div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}

export function parseRedirectUri(redirectUri: string) {
  return new URL(redirectUri);
}
