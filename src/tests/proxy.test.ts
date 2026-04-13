import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_CLIENT_ID } from "@/lib/auth-client";
import { getAuthSessionForRequest, readStoredAuthSession, saveAuthSession } from "@/lib/session";
import {
    extractCookieValue,
    extractSetCookieHeaders,
    findCookie,
} from "@/lib/test/cookie-helpers";
import { config, proxy } from "@/proxy";

async function createSessionCookie(expiresAt: number) {
  const request = new NextRequest("http://localhost:3000/api/test");
  const response = new Response(null);

  await saveAuthSession(request, response, {
    accessToken: "stored-access-token",
    refreshToken: "stored-refresh-token",
    expiresAt,
  });

  return extractCookieValue(
    findCookie(extractSetCookieHeaders(response), "decathlon_auth_session")!
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("proxy", () => {
  it("redirects unauthenticated requests to the auth login route", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/app/dashboard")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/api/auth/login"
    );
  });

  it("refreshes the session before the token expires", async () => {
    const sessionCookie = await createSessionCookie(Date.now() + 30_000);
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      Response.json({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 600,
      })
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/app/dashboard", {
        headers: {
          cookie: sessionCookie,
        },
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const refreshedCookie = findCookie(
      extractSetCookieHeaders(response),
      "decathlon_auth_session"
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/idp/token",
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      grant_type: "refresh_token",
      client_id: AUTH_CLIENT_ID,
      refresh_token: "stored-refresh-token",
    });
    expect(refreshedCookie).toBeTruthy();

    const refreshedSession = await getAuthSessionForRequest(
      new NextRequest("http://localhost:3000/app/dashboard", {
        headers: {
          cookie: extractCookieValue(refreshedCookie!),
        },
      }),
      new Response(null)
    );

    expect(readStoredAuthSession(refreshedSession)).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
  });

  it("clears the session and redirects to login if refresh fails", async () => {
    const sessionCookie = await createSessionCookie(Date.now() + 30_000);
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: "invalid_grant" },
        {
          status: 400,
        }
      )
    );

    const response = await proxy(
      new NextRequest("http://localhost:3000/app/dashboard", {
        headers: {
          cookie: sessionCookie,
        },
      })
    );
    const clearedCookie = findCookie(
      extractSetCookieHeaders(response),
      "decathlon_auth_session"
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/api/auth/login"
    );
    expect(clearedCookie).toContain("Max-Age=0");
  });

  it("keeps the public and auth exclusions in the matcher", () => {
    expect(config.matcher).toEqual(["/app/:path*"]);
  });
});
