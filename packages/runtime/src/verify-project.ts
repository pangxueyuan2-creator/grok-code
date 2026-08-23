import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { VerificationKind, VerificationResult, VerificationStep } from "@grok-code/core";

interface CommandSpec {
  kind: VerificationKind;
  command: string;
  args: string[];
}

function tail(value: string | undefined, max = 4000): string | undefined {
  if (!value) return undefined;
  return value.length <= max ? value : value.slice(-max);
}

function packageManager(cwd: string): "pnpm" | "npm" | "yarn" | "bun" {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function runArgs(manager: ReturnType<typeof packageManager>, script: string): string[] {
  return manager === "npm" ? ["run", script] : ["run", script];
}

/**
 * Discover deterministic, already-declared Node project checks.
 *
 * ForgePilot intentionally does not invent arbitrary shell commands. If a
 * project has no declared checks, verification stays unavailable and the task
 * cannot be promoted to DONE.
 */
export function discoverVerificationCommands(cwd: string): CommandSpec[] {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) return [];

  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
  } catch {
    return [];
  }

  const scripts = pkg.scripts ?? {};
  const manager = packageManager(cwd);
  const ordered: VerificationKind[] = ["typecheck", "lint", "test", "build"];
  return ordered
    .filter((kind) => typeof scripts[kind] === "string" && scripts[kind]?.trim())
    .map((kind) => ({ kind, command: manager, args: runArgs(manager, kind) }));
}

export function verifyProject(cwd: string, timeoutMs = 180_000): VerificationResult {
  const startedAt = new Date().toISOString();
  const steps: VerificationStep[] = [];

  for (const spec of discoverVerificationCommands(cwd)) {
    const started = Date.now();
    const result = spawnSync(spec.command, spec.args, {
      cwd,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });

    const rendered = [spec.command, ...spec.args].join(" ");
    if (result.error) {
      const code = (result.error as NodeJS.ErrnoException).code;
      steps.push({
        kind: spec.kind,
        command: rendered,
        status: code === "ENOENT" ? "unavailable" : "failed",
        summary:
          code === "ETIMEDOUT"
            ? `Timed out after ${timeoutMs}ms`
            : code === "ENOENT"
              ? `${spec.command} is not installed or not on PATH`
              : result.error.message,
        durationMs: Date.now() - started,
        stdoutTail: tail(result.stdout),
        stderrTail: tail(result.stderr),
      });
      continue;
    }

    const ok = result.status === 0;
    steps.push({
      kind: spec.kind,
      command: rendered,
      status: ok ? "passed" : "failed",
      summary: ok ? "passed" : `exited with code ${result.status ?? "unknown"}`,
      durationMs: Date.now() - started,
      exitCode: result.status ?? undefined,
      stdoutTail: tail(result.stdout),
      stderrTail: tail(result.stderr),
    });
  }

  return {
    steps,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}
