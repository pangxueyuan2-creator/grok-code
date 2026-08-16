import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface GrokSpawn {
  child: ChildProcess;
  /** Undefined in pipe mode; in file mode, the temp file receiving stdout. */
  stdoutFile?: string;
  stderrFile?: string;
  cleanup: () => void;
}

/**
 * Spawn grok capturing output. Pipe mode is the normal path. Some sandboxed
 * environments forbid named pipes (spawn with stdio:"pipe" fails with EPERM);
 * there we fall back to file redirection, which works everywhere.
 */
export function spawnGrok(
  bin: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number },
  mode: "pipe" | "file" = "pipe",
): GrokSpawn {
  if (mode === "pipe") {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    return { child, cleanup: () => {} };
  }

  const dir = mkdtempSync(join(tmpdir(), "grokcode-"));
  const stdoutFile = join(dir, "stdout.log");
  const stderrFile = join(dir, "stderr.log");
  const outFd = openSync(stdoutFile, "w");
  const errFd = openSync(stderrFile, "w");
  const child = spawn(bin, args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
  });
  const cleanup = () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  };
  return { child, stdoutFile, stderrFile, cleanup };
}
