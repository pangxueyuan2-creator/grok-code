import { JOURNAL_SCHEMA_VERSION, type JournalEvent } from "./journal.js";
import { redactSecrets } from "./secrets.js";
import type { Task } from "./task.js";

export interface RedactedBundle {
  format: "forgepilot-bundle";
  version: typeof JOURNAL_SCHEMA_VERSION;
  exportedAt: string;
  task: Task;
  events: JournalEvent[];
}

export function exportRedactedBundle(
  task: Task,
  events: readonly JournalEvent[],
  now = new Date(),
): RedactedBundle {
  return {
    format: "forgepilot-bundle",
    version: JOURNAL_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    task: {
      ...task,
      request: redactSecrets(task.request),
    },
    events: events
      .filter((event) => event.taskId === task.id)
      .map((event) => ({
        ...event,
        payload: JSON.parse(redactSecrets(JSON.stringify(event.payload))) as Record<string, unknown>,
      })),
  };
}

export function serializeBundle(bundle: RedactedBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function importBundle(raw: string): RedactedBundle {
  const parsed = JSON.parse(raw) as Partial<RedactedBundle>;
  if (parsed.format !== "forgepilot-bundle") {
    throw new Error("Not a ForgePilot task bundle.");
  }
  if (parsed.version !== JOURNAL_SCHEMA_VERSION) {
    throw new Error(`Unsupported bundle schema: ${String(parsed.version)}`);
  }
  if (!parsed.task || !Array.isArray(parsed.events)) {
    throw new Error("Bundle is missing task or events.");
  }
  return parsed as RedactedBundle;
}
