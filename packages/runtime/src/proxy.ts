import { spawnSync } from "node:child_process";

export interface ProxySettings {
  enabled: boolean;
  server?: string;
  /** Present when the proxy came from the Windows registry. */
  source: "env" | "windows-registry" | "none";
}

/**
 * Grok's Rust network stack ignores the Windows system proxy (it only honors
 * HTTP_PROXY / HTTPS_PROXY env vars). Without forwarding, headless runs hang
 * on machines that require a proxy (verified: Windows system proxy
 * 127.0.0.1:7897 with no env vars -> grok hangs forever on auth refresh).
 */
export function detectProxy(platform: NodeJS.Platform = process.platform): ProxySettings {
  const envServer =
    process.env["HTTPS_PROXY"] ?? process.env["https_proxy"] ?? process.env["HTTP_PROXY"] ?? process.env["http_proxy"];
  if (envServer) {
    return { enabled: true, server: envServer, source: "env" };
  }
  if (platform === "win32") {
    const reg = spawnSync(
      "reg",
      ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"],
      { encoding: "utf8", windowsHide: true },
    );
    const out = reg.stdout ?? "";
    const enable = /ProxyEnable\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(out);
    const server = /ProxyServer\s+REG_SZ\s+(.+)/.exec(out);
    const enabled = enable?.[1] !== "0" && enable?.[1] !== undefined && enable[1] !== "0x0";
    if (enabled && server?.[1]) {
      return { enabled: true, server: server[1].trim(), source: "windows-registry" };
    }
    if (enabled && !server?.[1]) {
      // PAC/auto-config URLs are not forwarded; user must configure manually.
      return { enabled: false, source: "windows-registry" };
    }
  }
  return { enabled: false, source: "none" };
}

/** Environment additions for spawning grok (never includes secrets). */
export function buildGrokEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    GROK_DISABLE_AUTOUPDATER: "1",
  };
  // Forward proxy only if the child would otherwise have none.
  if (!env["HTTP_PROXY"] && !env["http_proxy"]) {
    const proxy = detectProxy();
    if (proxy.enabled && proxy.server) {
      const url = /^[a-z]+:\/\//i.test(proxy.server) ? proxy.server : `http://${proxy.server}`;
      env["HTTP_PROXY"] = url;
      env["HTTPS_PROXY"] = url;
      const noProxy = env["NO_PROXY"] ?? env["no_proxy"] ?? "localhost,127.0.0.1,::1";
      env["NO_PROXY"] = noProxy;
    }
  }
  return env;
}
