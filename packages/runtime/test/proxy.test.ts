import { describe, expect, it } from "vitest";
import { buildGrokEnv } from "../src/proxy.js";

describe("buildGrokEnv", () => {
  it("always disables the auto-updater for spawned children", () => {
    const env = buildGrokEnv({});
    expect(env["GROK_DISABLE_AUTOUPDATER"]).toBe("1");
  });

  it("preserves an explicit proxy from the parent env", () => {
    const env = buildGrokEnv({ HTTPS_PROXY: "http://proxy:8080" });
    expect(env["HTTPS_PROXY"]).toBe("http://proxy:8080");
    expect(env["HTTP_PROXY"]).toBeUndefined();
  });

  it("passes through XAI_API_KEY untouched (and we never log it)", () => {
    const env = buildGrokEnv({ XAI_API_KEY: "xai-secret" });
    expect(env["XAI_API_KEY"]).toBe("xai-secret");
  });
});
