import { describe, expect, it } from "vitest";
import { buildGrokEnv, detectProxy } from "../src/proxy.js";

describe("detectProxy", () => {
  it("uses the supplied environment instead of process-global proxy state", () => {
    const proxy = detectProxy("linux", { HTTPS_PROXY: "http://proxy:8080" });
    expect(proxy).toEqual({ enabled: true, server: "http://proxy:8080", source: "env" });
  });

  it("reports no proxy for an empty non-Windows environment", () => {
    expect(detectProxy("linux", {})).toEqual({ enabled: false, source: "none" });
  });
});

describe("buildGrokEnv", () => {
  it("always disables the auto-updater for spawned children", () => {
    const env = buildGrokEnv({}, "linux");
    expect(env["GROK_DISABLE_AUTOUPDATER"]).toBe("1");
  });

  it("mirrors an explicit HTTPS proxy to HTTP for Grok's mixed network paths", () => {
    const env = buildGrokEnv({ HTTPS_PROXY: "http://proxy:8080" }, "linux");
    expect(env["HTTPS_PROXY"]).toBe("http://proxy:8080");
    expect(env["HTTP_PROXY"]).toBe("http://proxy:8080");
    expect(env["NO_PROXY"]).toBe("localhost,127.0.0.1,::1");
  });

  it("mirrors an explicit HTTP proxy to HTTPS/WSS without overwriting it", () => {
    const env = buildGrokEnv({ HTTP_PROXY: "http://proxy:8080" }, "linux");
    expect(env["HTTP_PROXY"]).toBe("http://proxy:8080");
    expect(env["HTTPS_PROXY"]).toBe("http://proxy:8080");
  });

  it("preserves distinct explicit HTTP and HTTPS proxies", () => {
    const env = buildGrokEnv(
      {
        HTTP_PROXY: "http://plain-proxy:8080",
        HTTPS_PROXY: "http://secure-proxy:8443",
        NO_PROXY: "localhost,internal.example",
      },
      "linux",
    );
    expect(env["HTTP_PROXY"]).toBe("http://plain-proxy:8080");
    expect(env["HTTPS_PROXY"]).toBe("http://secure-proxy:8443");
    expect(env["NO_PROXY"]).toBe("localhost,internal.example");
  });

  it("passes through XAI_API_KEY untouched (and we never log it)", () => {
    const env = buildGrokEnv({ XAI_API_KEY: "xai-secret" }, "linux");
    expect(env["XAI_API_KEY"]).toBe("xai-secret");
  });
});
