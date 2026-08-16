import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import type { Activity } from "@grok-code/core";
import { buildHeadlessArgs, type HeadlessOptions } from "./args.js";
import { buildGrokEnv } from "./proxy.js";
import { findGrokBinary } from "./locate.js";
import { parseStreamLine, reduceActivities, type HeadlessSummary } from "./parse.js";
import { spawnGrok } from "./spawn.js";
import { GrokRunError, GrokTimeoutError } from "./errors.js";

export interface HeadlessResult {
  activities: Activity[];
  summary: HeadlessSummary;
  exitCode: number | null;
  durationMs: number;
  ioMode: "pipe" | "file";
}

export interface RunHeadlessOptions extends HeadlessOptions {
  timeoutMs?: number;
  /** Force io mode; default "auto" (pipe, fall back to file on EPERM). */
  ioMode?: "pipe" | "file" | "auto";
  /** Override the grok binary (tests / advanced users). */
  binary?: string;
  /** Extra args placed before grok's own flags (e.g. ["fake-grok.mjs"]). */
  binaryArgs?: string[];
  /** Extra environment (never logged; secrets are passed through only). */
  env?: NodeJS.ProcessEnv;
  /** Called for each parsed activity (streaming consumption). */
  onActivity?: (activity: Activity) => void;
}

export async function runHeadless(options: RunHeadlessOptions): Promise<HeadlessResult> {
  const started = Date.now();
  const binary = options.binary ?? findGrokBinary();
  const args = [...(options.binaryArgs ?? []), ...buildHeadlessArgs(options)];
  const env = buildGrokEnv(options.env ?? process.env);
  const timeoutMs = options.timeoutMs ?? 0;

  const activities: Activity[] = [];
  const consume = (line: string) => {
    const acts = parseStreamLine(line);
    for (const act of acts) {
      activities.push(act);
      options.onActivity?.(act);
    }
  };

  const attempts: Array<"pipe" | "file"> =
    options.ioMode === "auto" ? ["pipe", "file"] : [options.ioMode];

  let lastSpawnError: unknown;
  for (const mode of attempts) {
    let spawned: ReturnType<typeof spawnGrok>;
    try {
      spawned = spawnGrok(binary, args, { cwd: options.cwd, env }, mode);
    } catch (err) {
      lastSpawnError = err;
      if ((err as NodeJS.ErrnoException).code === "EPERM" && mode === "pipe") continue;
      throw new GrokRunError(`启动 grok 失败: ${(err as Error).message}`);
    }
    const { child, stdoutFile, cleanup } = spawned;

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (err?: Error) => {
          if (settled) return;
          settled = true;
          try {
            cleanup();
          } catch {
            /* best effort */
          }
          err ? reject(err) : resolve();
        };

        if (timeoutMs > 0) {
          const timer = setTimeout(() => {
            try {
              child.kill();
            } catch {
              /* ignore */
            }
            finish(new GrokTimeoutError(timeoutMs, { cwd: options.cwd }));
          }, timeoutMs);
          timer.unref?.();
        }

        child.on("error", (err) => finish(err));
        child.on("close", (code, signal) => {
          if (code === 0) finish();
          else if (signal) finish(new GrokRunError(`grok 被信号终止: ${signal}`, { code, signal }));
          else finish(new GrokRunError(`grok 退出码 ${code}`, { code }));
        });

        if (stdoutFile === undefined) {
          const rl = createInterface({ input: child.stdout ?? undefined });
          rl.on("line", consume);
        }
      });

      // File mode: read the captured output after the child exits.
      if (stdoutFile !== undefined) {
        const content = await readFile(stdoutFile, "utf8").catch(() => "");
        for (const line of content.split(/\r?\n/)) consume(line);
      }

      const exitCode = child.exitCode;
      const summary = reduceActivities(activities);
      return {
        activities,
        summary,
        exitCode,
        durationMs: Date.now() - started,
        ioMode: mode,
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "EPERM" && mode === "pipe" && attempts.includes("file")) {
        // Async EPERM from the sandbox: retry with file redirection.
        continue;
      }
      if (err instanceof GrokTimeoutError) {
        const summary = reduceActivities(activities, true);
        return {
          activities,
          summary,
          exitCode: child.exitCode,
          durationMs: Date.now() - started,
          ioMode: mode,
        };
      }
      throw err;
    }
  }

  throw new GrokRunError(
    `无法启动 grok（${lastSpawnError instanceof Error ? lastSpawnError.message : "unknown"}）`,
  );
}
