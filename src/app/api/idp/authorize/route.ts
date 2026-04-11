import { type NextRequest, NextResponse } from "next/server";

import {
  buildAuthorizePage,
  createAuthorizationCode,
  parseRedirectUri,
  validateDemoCredentials,
} from "@/lib/mock-idp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAuthorizeParams(source: URLSearchParams | FormData) {
  const clientId = source.get("client_id");
  const redirectUri = source.get("redirect_uri");
  const state = source.get("state");
  const responseType = source.get("response_type");

  return {
    clientId: typeof clientId === "string" ? clientId : "",
    redirectUri: typeof redirectUri === "string" ? redirectUri : "",
    state: typeof state === "string" ? state : "",
    responseType: typeof responseType === "string" ? responseType : "",
  };
}

function renderAuthorizePage(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  responseType: string;
  errorMessage?: string;
  status?: number;
}) {
  return new Response(buildAuthorizePage(input), {
    status: input.status ?? 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function validateAuthorizeRequest(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  responseType: string;
}) {
  if (!input.clientId || !input.redirectUri || !input.state) {
    return "Faltan client_id, redirect_uri o state.";
  }

  if (input.responseType !== "code") {
    return "response_type debe ser code.";
  }

  try {
    parseRedirectUri(input.redirectUri);
  } catch {
    return "redirect_uri no es valida.";
  }

  return null;
}

export async function GET(request: NextRequest) {
  const params = getAuthorizeParams(request.nextUrl.searchParams);
  const validationError = validateAuthorizeRequest(params);

  if (validationError) {
    return renderAuthorizePage({
      ...params,
      errorMessage: validationError,
      status: 400,
    });
  }

  return renderAuthorizePage(params);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = getAuthorizeParams(formData);
  const email = formData.get("email");
  const password = formData.get("password");
  const validationError = validateAuthorizeRequest(params);

  if (validationError) {
    return renderAuthorizePage({
      ...params,
      errorMessage: validationError,
      status: 400,
    });
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !validateDemoCredentials(email, password)
  ) {
    return renderAuthorizePage({
      ...params,
      errorMessage: "Credenciales invalidas. Usa demo@test.com / password123.",
      status: 401,
    });
  }

  const code = createAuthorizationCode({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
  });
  const redirectUrl = parseRedirectUri(params.redirectUri);

  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", params.state);

  return NextResponse.redirect(redirectUrl, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
