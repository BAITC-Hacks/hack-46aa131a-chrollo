export async function readBoundedJson(
  request: Request,
  limit: number,
): Promise<{ body: unknown; error?: never } | { error: Response; body?: never }> {
  const fail = (message: string, status: number) => ({
    error: Response.json({ error: message }, { status }),
  });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const url = new URL(origin);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.host !== (request.headers.get("host") ?? new URL(request.url).host)
      )
        return fail("Запрос должен поступать из этого приложения.", 403);
    } catch {
      return fail("Некорректный источник запроса.", 403);
    }
  }
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    return fail("Слишком большой запрос.", 413);
  const reader = request.body?.getReader();
  if (!reader) return fail("Пустой запрос.", 400);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return fail("Слишком большой запрос.", 413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { body: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return fail("Некорректный JSON.", 400);
  } finally {
    reader.releaseLock();
  }
}
