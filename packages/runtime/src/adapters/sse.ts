export async function* iterateSse(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      yield chunk;
      idx = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) yield buffer;
}

export function sseDataLines(chunk: string): string[] {
  const lines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("data:")) lines.push(line.slice(5).trim());
  }
  return lines;
}
