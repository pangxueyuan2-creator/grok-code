import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildGrokEnv } from "./proxy.js";
import { findGrokBinary, parseGrokVersion } from "./locate.js";

export interface GrokInfo {
  found: boolean;
  version?: string;
  sha?: string;
  /** Whether auth material exists (we never read its contents). */
  authenticated: boolean;
  /** Where sessions live for this install (used for resume). */
  sessionsDir: string;
  models: string[];
}

export interface ProbeOptions {
  binary?: string;
  /** Extra args placed before grok's own flags (tests). */
  binaryArgs?: string[];
  env?: NodeJS.ProcessEnv;
}

export function probeGrok(options: ProbeOptions = {}): GrokInfo {
  const home = homedir();
  const env = buildGrokEnv(options.env ?? process.env);
  const sessionsDir = env["GROK_HOME"]
    ? join(env["GROK_HOME"], "sessions")
    : join(home, ".grok", "sessions");
  try {
    const bin = options.binary ?? findGrokBinary();
    const prefix = options.binaryArgs ?? [];
    const version = spawnSync(bin, [...prefix, "--version"], {
      encoding: "utf8",
      env,
      windowsHide: true,
      timeout: 15000,
    });
    const parsed = parseGrokVersion(version.stdout ?? "");
    let models: string[] = [];
    const modelsProbe = spawnSync(bin, [...prefix, "models"], {
      encoding: "utf8",
      env,
      windowsHide: true,
      timeout: 15000,
    });
    const modelLines = (modelsProbe.stdout ?? "")
      .split(/\r?\n/)
      .filter((l) => /^\s*[-*]\s+[\w.-]+/.test(l))
      .map((l) => l.replace(/^\s*[-*]\s+/, "").replace(/\s*\(default\)\s*$/, "").trim())
      .filter(Boolean);
    models = [...new Set(modelLines)];
    const authFile = env["GROK_AUTH_PATH"] ?? join(home, ".grok", "auth.json");
    return {
      found: true,
      version: parsed.version,
      sha: parsed.sha,
      authenticated: existsSync(authFile),
      sessionsDir,
      models,
    };
  } catch {
    return { found: false, authenticated: false, sessionsDir, models: [] };
  }
}
