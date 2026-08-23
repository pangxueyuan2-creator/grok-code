import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { TaskJournal, type JournalEvent } from "@grok-code/core";

const SAFE_TASK_ID = /^[A-Za-z0-9._-]+$/;

export function defaultForgePilotHome(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env["FORGEPILOT_HOME"]?.trim();
  return configured ? resolve(configured) : join(homedir(), ".forgepilot");
}

/**
 * Durable append-only storage for TaskJournal events.
 *
 * Events are written synchronously on purpose: journal durability matters more
 * than shaving a few milliseconds from an agent control-plane event. The
 * TaskJournal already removes credential/reasoning fields before events reach
 * this store.
 */
export class JournalStore {
  readonly root: string;

  constructor(root = join(defaultForgePilotHome(), "journals")) {
    this.root = resolve(root);
  }

  pathFor(taskId: string): string {
    if (!SAFE_TASK_ID.test(taskId)) {
      throw new Error(`Invalid task id: ${taskId}`);
    }
    return join(this.root, `${taskId}.jsonl`);
  }

  append(event: JournalEvent): string {
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    const path = this.pathFor(event.taskId);
    appendFileSync(path, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    return path;
  }

  load(taskId: string): TaskJournal | undefined {
    const path = this.pathFor(taskId);
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }

    const events: JournalEvent[] = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        throw new Error(`Corrupt journal ${path} at line ${index + 1}`);
      }
      if (!value || typeof value !== "object") {
        throw new Error(`Invalid journal event ${path} at line ${index + 1}`);
      }
      const event = value as JournalEvent;
      if (event.taskId !== taskId || typeof event.seq !== "number" || typeof event.type !== "string") {
        throw new Error(`Invalid journal event ${path} at line ${index + 1}`);
      }
      events.push(event);
    }
    return TaskJournal.replay(events);
  }
}
