import { describe, expect, it, vi } from "vitest";
import { main } from "../src/index.js";

describe("forgepilot CLI", () => {
  it("lists providers by env-var name, never a raw key", async () => {
    const out = await main(["providers"]);
    expect(out).toContain("xai");
    expect(out).toContain("XAI_API_KEY");
    expect(out).toContain("openai-compatible");
    expect(out).not.toMatch(/\bsk-[A-Za-z0-9]/);
    expect(out).not.toMatch(/\bxai-[A-Za-z0-9]{8,}/);
  });

  it("makes planning explicitly dry-run and keeps flag values out of the prompt", async () => {
    const out = await main([
      "plan",
      "Add a /health endpoint",
      "--provider",
      "xai",
      "--mode",
      "AUTO",
    ]);
    expect(out).toContain("DRY RUN");
    expect(out).toContain("prompt:     Add a /health endpoint");
    expect(out).not.toContain("Add a /health endpoint xai AUTO");
    expect(out).toContain("provider:   xai");
    expect(out).toContain("mode:       AUTO");
    expect(out).toContain("fallback:   forbidden");
    expect(out).toContain("apiKeyEnv:  XAI_API_KEY");
  });

  it("routes run to the real dispatcher instead of pretending a plan executed", async () => {
    const dispatchImpl = vi.fn(async (options) => `dispatched:${options.prompt}:${options.mode}`);
    const out = await main(["run", "fix", "the", "tests", "--mode", "SAFE"], { dispatchImpl });
    expect(out).toBe("dispatched:fix the tests:SAFE");
    expect(dispatchImpl).toHaveBeenCalledOnce();
  });

  it("honors explicit fallback and local-only flags during planning", async () => {
    const fallback = await main(["plan", "review auth", "--allow-fallback"]);
    expect(fallback).toContain("fallback:   explicit only");
    const local = await main(["plan", "review auth", "--local-only", "--provider", "local"]);
    expect(local).toContain("remote:     loopback only");
    expect(local).toContain("provider:   local");
  });

  it("prints an honest compatibility matrix", async () => {
    const out = await main(["compat"]);
    expect(out).toContain("real autonomous coding dispatch");
    expect(out).toContain("tool loop pending");
    expect(out).toContain("Durable resume");
    expect(out).toContain("Silent provider switch   never");
  });
});
