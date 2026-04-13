import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { GET as authorizeGet, POST as authorizePost } from "@/app/api/idp/authorize/route";
import { POST as logoutPost } from "@/app/api/idp/logout/route";
import { POST as tokenPost } from "@/app/api/idp/token/route";
import { GET as userinfoGet } from "@/app/api/idp/userinfo/route";
import { resetMockIdpStore } from "@/lib/mock-idp";

const authorizeUrl =
  "http://localhost:3000/api/idp/authorize?client_id=web-client&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback&state=test-state&response_type=code";

beforeEach(() => {
  resetMockIdpStore();
});

function createFormRequest(url: string, formData: FormData) {
  return new NextRequest(url, {
    method: "POST",
    body: formData,
  });
}

async function issueAuthorizationCode() {
  const formData = new FormData();

  formData.set("client_id", "web-client");
  formData.set("redirect_uri", "http://localhost:3000/callback");
  formData.set("state", "test-state");
  formData.set("response_type", "code");
  formData.set("email", "demo@test.com");
  formData.set("password", "password123");

  const response = await authorizePost(createFormRequest(authorizeUrl, formData));

  expect(response.status).toBe(307);

  const location = response.headers.get("location");

  expect(location).toBeTruthy();

  return new URL(location!);
}

async function exchangeAuthorizationCode(code: string) {
  const body = new FormData();

  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("client_id", "web-client");
  body.set("redirect_uri", "http://localhost:3000/callback");

  const response = await tokenPost(
    new NextRequest("http://localhost:3000/api/idp/token", {
      method: "POST",
      body,
    })
  );

  expect(response.status).toBe(200);

  return (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
}

describe("Mock idp route handlers", () => {
  it("renders the authorize login page", async () => {
    const response = await authorizeGet(new NextRequest(authorizeUrl));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Iniciar sesión");
    expect(html).toContain("demo@test.com");
  });

  it("redirects with code and state after valid login", async () => {
    const redirectUrl = await issueAuthorizationCode();

    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      "http://localhost:3000/callback"
    );
    expect(redirectUrl.searchParams.get("state")).toBe("test-state");
    expect(redirectUrl.searchParams.get("code")).toBeTruthy();
  });

  it("exchanges an authorization code for access and refresh tokens", async () => {
    const redirectUrl = await issueAuthorizationCode();
    const code = redirectUrl.searchParams.get("code");

    expect(code).toBeTruthy();

    const tokenResponse = await exchangeAuthorizationCode(code!);

    expect(tokenResponse.token_type).toBe("Bearer");
    expect(tokenResponse.expires_in).toBe(600);
    expect(tokenResponse.access_token).toBeTruthy();
    expect(tokenResponse.refresh_token).toBeTruthy();
  });

  it("returns userinfo for a valid bearer token", async () => {
    const redirectUrl = await issueAuthorizationCode();
    const tokenResponse = await exchangeAuthorizationCode(
      redirectUrl.searchParams.get("code")!
    );

    const response = await userinfoGet(
      new NextRequest("http://localhost:3000/api/idp/userinfo", {
        headers: {
          authorization: `Bearer ${tokenResponse.access_token}`,
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sub: "demo-user",
      email: "demo@test.com",
      name: "Demo User",
    });
  });

  it("revokes refresh tokens on logout", async () => {
    const redirectUrl = await issueAuthorizationCode();
    const tokenResponse = await exchangeAuthorizationCode(
      redirectUrl.searchParams.get("code")!
    );

    const logoutResponse = await logoutPost(
      new NextRequest("http://localhost:3000/api/idp/logout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${tokenResponse.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: tokenResponse.refresh_token,
        }),
      })
    );

    expect(logoutResponse.status).toBe(200);
    await expect(logoutResponse.json()).resolves.toMatchObject({
      success: true,
      revoked_tokens: 1,
    });

    const refreshResponse = await tokenPost(
      new NextRequest("http://localhost:3000/api/idp/token", {
        method: "POST",
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: tokenResponse.refresh_token,
        }),
        headers: {
          "content-type": "application/json",
        },
      })
    );

    expect(refreshResponse.status).toBe(400);
    await expect(refreshResponse.json()).resolves.toMatchObject({
      error: "invalid_grant",
    });
  });
});
