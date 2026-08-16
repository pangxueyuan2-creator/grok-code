import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { GrokNotFoundError } from "./errors.js";

/** Resolve the grok executable: GROK_PATH > PATH lookup > managed install. */
export function findGrokBinary(platform: NodeJS.Platform = process.platform): string {
  const explicit = process.env["GROK_PATH"];
  if (explicit && existsSync(explicit)) return explicit;
  if (explicit) {
    throw new GrokNotFoundError({ hint: `GROK_PATH=${explicit} does not exist` });
  }

  const candidates: string[] = [];
  if (platform === "win32") {
    candidates.push(
      join(homedir(), ".grok", "bin", "grok.exe"),
      join(homedir(), ".grok", "shim", "grok.cmd"),
      "grok.cmd",
    );
  } else {
    candidates.push(join(homedir(), ".grok", "bin", "grok"), "grok");
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
    const probe = spawnSync(candidate, ["--version"], {
      shell: platform === "win32",
      stdio: "ignore",
      windowsHide: true,
    });
    if (probe.status === 0) return candidate;
  }

  throw new GrokNotFoundError({ candidates, platform });
}

/** Parse "grok 1.0.4 (d846eb93d9) [stable]" into structured data. */
export function parseGrokVersion(stdout: string): { version: string; sha?: string; channel?: string } {
  const m = stdout.trim().match(/^(?:grok\s+)?([\d.]+)(?:\s+\(([0-9a-f]+)\))?(?:\s+\[([^\]]+)\])?/i);
  if (!m?.[1]) return { version: "unknown" };
  return { version: m[1], sha: m[2], channel: m[3] };
}
