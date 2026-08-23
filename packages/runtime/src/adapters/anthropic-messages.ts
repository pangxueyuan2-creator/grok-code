import type { Activity } from "@grok-code/core";
import { AdapterError, type AdapterContext, type ProtocolAdapter } from "./types.js";
import { iterateSse, sseDataLines } from "./sse.js";

export const anthropicMessagesAdapter: ProtocolAdapter = {
  protocol: "anthropic-messages",
  async *stream(ctx: AdapterContext): AsyncIterable<Activity> {
    const fetchImpl = ctx.fetch ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.request.timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${ctx.profile.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ctx.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ctx.profile.model,
          max_tokens: 1024,
          stream: true,
          messages: ctx.request.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ctx.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new AdapterError(`anthropic-messages ${res.status}`, res.status);
    for await (const chunk of iterateSse(res.body)) {
      for (const data of sseDataLines(chunk)) {
        if (!data) continue;
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string };
          usage?: Record<string, unknown>;
        };
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          yield { type: "text", data: parsed.delta.text };
        }
        if (parsed.type === "message_stop") {
          yield { type: "end", stopReason: "end_turn", usage: parsed.usage };
        }
      }
    }
  },
};
