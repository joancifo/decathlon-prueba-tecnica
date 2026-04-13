import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AuthSessionData = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  /** CSRF state for the in-flight authorization code flow (server-only). */
  oauthState?: string;
};

export type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const SESSION_COOKIE_NAME = "decathlon_auth_session";

function getSessionPassword() {
  const password = process.env.SESSION_PASSWORD;

  if (!password) {
    throw new Error("Missing SESSION_PASSWORD in .env.local");
  }

  if (password.length < 32) {
    throw new Error("SESSION_PASSWORD must be at least 32 characters long");
  }

  return password;
}

function getSessionOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: getSessionPassword(),
    cookieOptions: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getAuthSession() {
  const cookieStore = await cookies();

  return getIronSession<AuthSessionData>(cookieStore, getSessionOptions());
}

export async function getAuthSessionForRequest(
  request: Request,
  response: Response
) {
  return getIronSession<AuthSessionData>(request, response, getSessionOptions());
}

export function readStoredAuthSession(
  session: AuthSessionData | IronSession<AuthSessionData>
): StoredAuthSession | null {
  if (
    typeof session.accessToken !== "string" ||
    typeof session.refreshToken !== "string" ||
    typeof session.expiresAt !== "number"
  ) {
    return null;
  }

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
  };
}

export async function saveAuthSession(
  request: Request,
  response: Response,
  sessionData: StoredAuthSession
) {
  const session = await getAuthSessionForRequest(request, response);

  session.accessToken = sessionData.accessToken;
  session.refreshToken = sessionData.refreshToken;
  session.expiresAt = sessionData.expiresAt;
  delete session.oauthState;

  await session.save();
}

export async function destroyAuthSession(request: Request, response: Response) {
  const session = await getAuthSessionForRequest(request, response);
  const storedSession = readStoredAuthSession(session);

  session.destroy();

  return storedSession;
}
