import { describe, expect, it } from "vitest";
import { ProviderRegistry, createProviderProfile } from "../src/provider.js";

describe("provider profiles", () => {
  it("fills safe defaults for xAI, OpenAI, and Anthropic", () => {
    const xai = createProviderProfile({ id: "xai-main", kind: "xai", model: "grok-code-fast" });
    const openai = createProviderProfile({ id: "openai-main", kind: "openai", model: "gpt-5" });
    const anthropic = createProviderProfile({
      id: "anthropic-main",
      kind: "anthropic",
      model: "claude-sonnet",
    });

    expect(xai.baseUrl).toBe("https://api.x.ai/v1");
    expect(xai.apiKeyEnv).toBe("XAI_API_KEY");
    expect(openai.protocol).toBe("openai-responses");
    expect(anthropic.protocol).toBe("anthropic-messages");
  });

  it("requires explicit endpoint metadata for custom providers", () => {
    expect(() =>
      createProviderProfile({ id: "local", kind: "openai-compatible", model: "qwen" }),
    ).toThrow(/baseUrl/);
  });

  it("allows loopback HTTP but rejects remote plaintext transport", () => {
    const local = createProviderProfile({
      id: "ollama",
      kind: "openai-compatible",
      model: "qwen3-coder",
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKeyEnv: "OLLAMA_API_KEY",
    });

    expect(local.baseUrl).toBe("http://127.0.0.1:11434/v1");
    expect(() =>
      createProviderProfile({
        id: "unsafe",
        kind: "openai-compatible",
        model: "model",
        baseUrl: "http://example.com/v1",
        apiKeyEnv: "EXAMPLE_API_KEY",
      }),
    ).toThrow(/HTTPS/);
  });

  it("stores only environment variable names, never raw credentials", () => {
    expect(() =>
      createProviderProfile({
        id: "bad-secret",
        kind: "openai-compatible",
        model: "model",
        baseUrl: "https://example.com/v1",
        apiKeyEnv: "sk-secret-value",
      }),
    ).toThrow(/environment-variable name/);
  });

  it("rejects credentials embedded in provider URLs", () => {
    expect(() =>
      createProviderProfile({
        id: "userinfo-secret",
        kind: "openai-compatible",
        model: "model",
        baseUrl: "https://user:super-secret@example.com/v1",
        apiKeyEnv: "EXAMPLE_API_KEY",
      }),
    ).toThrow(/embedded credentials/);
  });

  it("does not echo malformed provider URLs in validation errors", () => {
    const secret = "token-that-must-not-reach-logs";
    let message = "";
    try {
      createProviderProfile({
        id: "malformed-url",
        kind: "openai-compatible",
        model: "model",
        baseUrl: `https://[${secret}`,
        apiKeyEnv: "EXAMPLE_API_KEY",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/Invalid provider base URL/);
    expect(message).not.toContain(secret);
  });
});

describe("provider registry", () => {
  it("rejects duplicate provider identifiers and lists deterministically", () => {
    const a = createProviderProfile({ id: "a", kind: "xai", model: "grok" });
    const b = createProviderProfile({ id: "b", kind: "openai", model: "gpt" });
    const registry = new ProviderRegistry([b, a]);

    expect(registry.list().map((provider) => provider.id)).toEqual(["a", "b"]);
    expect(registry.get("a")).toBe(a);
    expect(() => registry.register(a)).toThrow(/already registered/);
    expect(() => registry.get("missing")).toThrow(/Unknown provider/);
  });
});
