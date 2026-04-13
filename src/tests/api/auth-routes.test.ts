import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as callbackGet } from "@/app/api/auth/callback/route";
import { GET as loginGet } from "@/app/api/auth/login/route";
import { GET as logoutGet } from "@/app/api/auth/logout/route";
import { POST as authorizePost } from "@/app/api/idp/authorize/route";
import { POST as idpLogoutPost } from "@/app/api/idp/logout/route";
import { POST as tokenPost } from "@/app/api/idp/token/route";
import { resetMockIdpStore } from "@/lib/mock-idp";
import { getAuthSessionForRequest, readStoredAuthSession } from "@/lib/session";
import {
    extractCookieValue,
    extractSetCookieHeaders,
    findCookie,
} from "@/lib/test/cookie-helpers";

function createInternalFetchResponse(url: URL, init?: RequestInit) {
  const method = init?.method ?? "GET";
  const headers = new Headers(init?.headers);

  if (url.pathname === "/api/idp/token" && method === "POST") {
    return tokenPost(
      new NextRequest(url, {
        method,
        headers,
        body: init?.body,
      })
    );
  }

  if (url.pathname === "/api/idp/logout" && method === "POST") {
    return idpLogoutPost(
      new NextRequest(url, {
        method,
        headers,
        body: init?.body,
      })
    );
  }

  return Promise.resolve(new Response("Not found", { status: 404 }));
}

async function loginThroughMockIdp() {
  const loginResponse = await loginGet(
    new NextRequest("http://localhost:3000/api/auth/login")
  );
  const authorizeUrl = new URL(loginResponse.headers.get("location")!);
  const sessionCookieFromLogin = findCookie(
    extractSetCookieHeaders(loginResponse),
    "decathlon_auth_session"
  );
  const authorizeForm = new FormData();

  authorizeForm.set("client_id", authorizeUrl.searchParams.get("client_id")!);
  authorizeForm.set(
    "redirect_uri",
    authorizeUrl.searchParams.get("redirect_uri")!
  );
  authorizeForm.set("state", authorizeUrl.searchParams.get("state")!);
  authorizeForm.set(
    "response_type",
    authorizeUrl.searchParams.get("response_type")!
  );
  authorizeForm.set("email", "demo@test.com");
  authorizeForm.set("password", "password123");

  const authorizeResponse = await authorizePost(
    new NextRequest(authorizeUrl, {
      method: "POST",
      body: authorizeForm,
    })
  );
  const callbackResponse = await callbackGet(
    new NextRequest(authorizeResponse.headers.get("location")!, {
      headers: {
        cookie: extractCookieValue(sessionCookieFromLogin!),
      },
    })
  );

  return { callbackResponse };
}

beforeEach(() => {
  resetMockIdpStore();
  vi.stubGlobal("fetch", vi.fn(createInternalFetchResponse));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Server-side auth flow", () => {
  it("redirects to the mock IdP and stores oauth state in the encrypted session", async () => {
    const response = await loginGet(
      new NextRequest("http://localhost:3000/api/auth/login")
    );
    const redirectUrl = new URL(response.headers.get("location")!);
    const sessionCookie = findCookie(
      extractSetCookieHeaders(response),
      "decathlon_auth_session"
    );

    expect(response.status).toBe(307);
    expect(redirectUrl.pathname).toBe("/api/idp/authorize");
    expect(redirectUrl.searchParams.get("client_id")).toBe("nextjs-server-app");
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("state")).toBeTruthy();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toMatch(/SameSite=(Lax|lax)/);

    const session = await getAuthSessionForRequest(
      new NextRequest("http://localhost:3000/", {
        headers: {
          cookie: extractCookieValue(sessionCookie!),
        },
      }),
      new Response(null)
    );

    expect(session.oauthState).toBe(redirectUrl.searchParams.get("state"));
  });

  it("exchanges the code and stores the encrypted session in a cookie", async () => {
    const { callbackResponse } = await loginThroughMockIdp();
    const setCookies = extractSetCookieHeaders(callbackResponse);
    const sessionCookie = findCookie(setCookies, "decathlon_auth_session");

    expect(callbackResponse.status).toBe(307);
    expect(callbackResponse.headers.get("location")).toBe(
      "http://localhost:3000/app/dashboard"
    );
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toMatch(/SameSite=(Lax|lax)/);

    const sessionRequest = new NextRequest("http://localhost:3000/app/dashboard", {
      headers: {
        cookie: extractCookieValue(sessionCookie!),
      },
    });
    const session = await getAuthSessionForRequest(
      sessionRequest,
      new Response(null)
    );
    const storedSession = readStoredAuthSession(session);

    expect(session.oauthState).toBeUndefined();
    expect(storedSession).not.toBeNull();
    expect(storedSession?.accessToken).toBeTruthy();
    expect(storedSession?.refreshToken).toBeTruthy();
    expect(storedSession?.expiresAt).toBeGreaterThan(Date.now());
    expect(sessionCookie).not.toContain(storedSession!.accessToken);
    expect(sessionCookie).not.toContain(storedSession!.refreshToken);
  });

  it("destroys the encrypted session and revokes the refresh token on logout", async () => {
    const { callbackResponse } = await loginThroughMockIdp();
    const loggedInSessionCookie = extractCookieValue(
      findCookie(
        extractSetCookieHeaders(callbackResponse),
        "decathlon_auth_session"
      )!
    );
    const logoutResponse = await logoutGet(
      new NextRequest("http://localhost:3000/api/auth/logout", {
        headers: {
          cookie: loggedInSessionCookie,
        },
      })
    );
    const clearedSessionCookie = findCookie(
      extractSetCookieHeaders(logoutResponse),
      "decathlon_auth_session"
    );
    const sessionAfterLogout = await getAuthSessionForRequest(
      new NextRequest("http://localhost:3000/app/dashboard", {
        headers: {
          cookie: extractCookieValue(clearedSessionCookie!),
        },
      }),
      new Response(null)
    );

    expect(logoutResponse.status).toBe(307);
    expect(logoutResponse.headers.get("location")).toBe("http://localhost:3000/");
    expect(clearedSessionCookie).toContain("Max-Age=0");
    expect(readStoredAuthSession(sessionAfterLogout)).toBeNull();
  });
});
