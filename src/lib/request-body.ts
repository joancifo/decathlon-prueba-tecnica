export async function readRequestBodyAsMap(
  request: Request
): Promise<Map<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;

    return new Map(
      Object.entries(body).map(([key, value]) => [key, String(value ?? "")])
    );
  }

  const formData = await request.formData();

  return new Map(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)])
  );
}
