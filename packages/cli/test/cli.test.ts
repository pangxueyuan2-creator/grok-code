import { describe, expect, it } from "vitest";
import { main } from "../src/index.js";

describe("forgepilot CLI", () => {
  it("lists providers by env-var name, never a raw key", () => {
    const out = main(["providers"]);
    expect(out).toContain("xai");
    expect(out).toContain("XAI_API_KEY");
    expect(out).toContain("openai-compatible");
    expect(out).not.toMatch(/\bsk-[A-Za-z0-9]/);
    expect(out).not.toMatch(/\bxai-[A-Za-z0-9]{8,}/);
  });

  it("plans a run without silent fallback", () => {
    const out = main(["run", "Add a /health endpoint", "--provider", "xai", "--mode", "AUTO"]);
    expect(out).toContain("provider:   xai");
    expect(out).toContain("mode:       AUTO");
    expect(out).toContain("fallback:   forbidden");
    expect(out).toContain("apiKeyEnv:  XAI_API_KEY");
  });

  it("honors explicit fallback and local-only flags", () => {
    const fallback = main(["run", "review auth", "--allow-fallback"]);
    expect(fallback).toContain("fallback:   explicit only");
    const local = main(["run", "review auth", "--local-only", "--provider", "local"]);
    expect(local).toContain("remote:     loopback only");
    expect(local).toContain("provider:   local");
  });

  it("prints the compatibility matrix", () => {
    const out = main(["compat"]);
    expect(out).toContain("Silent provider switch   never");
    expect(out).toContain("Windows");
  });
});
