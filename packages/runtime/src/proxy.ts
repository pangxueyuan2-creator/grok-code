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
export function detectProxy(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ProxySettings {
  const envServer =
    env["HTTPS_PROXY"] ?? env["https_proxy"] ?? env["HTTP_PROXY"] ?? env["http_proxy"];
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
export function buildGrokEnv(
  base: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    GROK_DISABLE_AUTOUPDATER: "1",
  };

  const explicitHttps = env["HTTPS_PROXY"] ?? env["https_proxy"];
  const explicitHttp = env["HTTP_PROXY"] ?? env["http_proxy"];
  const detected = explicitHttps || explicitHttp ? detectProxy(platform, env) : detectProxy(platform, base);

  if (detected.enabled && detected.server) {
    const url = /^[a-z]+:\/\//i.test(detected.server) ? detected.server : `http://${detected.server}`;

    // Grok may use both HTTPS/WSS and HTTP endpoints internally. If the parent
    // only provided one proxy variable, mirror it into the missing counterpart
    // without overwriting an explicitly distinct proxy value.
    if (!env["HTTP_PROXY"] && !env["http_proxy"]) env["HTTP_PROXY"] = url;
    if (!env["HTTPS_PROXY"] && !env["https_proxy"]) env["HTTPS_PROXY"] = url;

    const noProxy = env["NO_PROXY"] ?? env["no_proxy"] ?? "localhost,127.0.0.1,::1";
    env["NO_PROXY"] = noProxy;
  }

  return env;
}
