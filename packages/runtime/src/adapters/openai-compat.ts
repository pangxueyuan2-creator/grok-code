import type { Activity } from "@grok-code/core";
import { redactSecret } from "@grok-code/core";
import { AdapterError, type AdapterContext, type ProtocolAdapter } from "./types.js";
import { iterateSse, sseDataLines } from "./sse.js";

async function requestWithRetry(ctx: AdapterContext, url: string, body: unknown): Promise<Response> {
  const fetchImpl = ctx.fetch ?? fetch;
  let lastError: Error | undefined;
  const attempts = Math.max(1, ctx.request.maxRetries + 1);
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.request.timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctx.signal ?? controller.signal,
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new AdapterError(`Provider ${ctx.profile.id} returned ${res.status}`, res.status);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new AdapterError(
    redactSecret(lastError?.message ?? "provider request failed", ctx.apiKey),
  );
}

export const openaiCompatibleAdapter: ProtocolAdapter = {
  protocol: "openai-compatible",
  async *stream(ctx: AdapterContext): AsyncIterable<Activity> {
    const url = `${ctx.profile.baseUrl}/chat/completions`;
    const res = await requestWithRetry(ctx, url, {
      model: ctx.profile.model,
      stream: true,
      messages: ctx.request.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    if (!res.ok) {
      throw new AdapterError(`openai-compatible ${res.status}`, res.status);
    }
    for await (const chunk of iterateSse(res.body)) {
      for (const data of sseDataLines(chunk)) {
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as {
          choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
          usage?: Record<string, unknown>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield { type: "text", data: delta };
        const finish = parsed.choices?.[0]?.finish_reason;
        if (finish) {
          yield { type: "end", stopReason: finish, usage: parsed.usage };
        }
      }
    }
  },
};
