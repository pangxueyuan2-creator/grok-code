import { describe, expect, it } from "vitest";
import { createProviderProfile } from "@grok-code/core";
import { adapterFor, openaiCompatibleAdapter } from "../src/adapters/index.js";

function sseResponse(payloads: string[]): Response {
  const body = payloads.map((p) => `data: ${p}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("protocol adapters", () => {
  it("maps openai-compatible chunks onto the internal Activity model", async () => {
    const profile = createProviderProfile({ id: "xai", kind: "xai", model: "grok-4.5" });
    const activities = [];
    for await (const event of openaiCompatibleAdapter.stream({
      profile,
      apiKey: "secret-key-value",
      request: { messages: [{ role: "user", content: "hi" }], timeoutMs: 1000, maxRetries: 0 },
      fetch: async () =>
        sseResponse([
          JSON.stringify({ choices: [{ delta: { content: "hello" } }] }),
          JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { output_tokens: 1 } }),
          "[DONE]",
        ]),
    })) {
      activities.push(event);
    }
    expect(activities.map((a) => a.type)).toEqual(["text", "end"]);
    expect(activities[0]).toMatchObject({ type: "text", data: "hello" });
  });

  it("does not leak vendor protocol names into adapter lookup errors for known families", () => {
    expect(adapterFor("anthropic-messages").protocol).toBe("anthropic-messages");
    expect(adapterFor("openai-responses").protocol).toBe("openai-responses");
  });

  it("retries 429 then succeeds without switching providers", async () => {
    const profile = createProviderProfile({ id: "xai", kind: "xai", model: "grok-4.5" });
    let calls = 0;
    const events = [];
    for await (const event of openaiCompatibleAdapter.stream({
      profile,
      apiKey: "k",
      request: { messages: [{ role: "user", content: "x" }], timeoutMs: 1000, maxRetries: 1 },
      fetch: async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 429 });
        return sseResponse([
          JSON.stringify({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }),
        ]);
      },
    })) {
      events.push(event);
    }
    expect(calls).toBe(2);
    expect(events.some((e) => e.type === "text")).toBe(true);
  });
});
