import type { Activity } from "@grok-code/core";
import { AdapterError, type AdapterContext, type ProtocolAdapter } from "./types.js";
import { iterateSse, sseDataLines } from "./sse.js";

export const openaiResponsesAdapter: ProtocolAdapter = {
  protocol: "openai-responses",
  async *stream(ctx: AdapterContext): AsyncIterable<Activity> {
    const fetchImpl = ctx.fetch ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.request.timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(`${ctx.profile.baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.apiKey}`,
        },
        body: JSON.stringify({
          model: ctx.profile.model,
          input: ctx.request.messages.map((m) => m.content).join("\n"),
          stream: true,
        }),
        signal: ctx.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new AdapterError(`openai-responses ${res.status}`, res.status);
    for await (const chunk of iterateSse(res.body)) {
      for (const data of sseDataLines(chunk)) {
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: string;
          response?: { status?: string; usage?: Record<string, unknown> };
        };
        if (parsed.type === "response.output_text.delta" && parsed.delta) {
          yield { type: "text", data: parsed.delta };
        }
        if (parsed.type === "response.completed") {
          yield { type: "end", stopReason: "end_turn", usage: parsed.response?.usage };
        }
      }
    }
  },
};
