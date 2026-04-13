export function extractSetCookieHeaders(response: Response) {
  return response.headers.getSetCookie();
}

export function extractCookieValue(setCookieHeader: string) {
  return setCookieHeader.split(";")[0] ?? "";
}

export function findCookie(headers: string[], cookieName: string) {
  return headers.find((header) => header.startsWith(`${cookieName}=`)) ?? null;
}
