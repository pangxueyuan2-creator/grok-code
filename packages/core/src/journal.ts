import { redactSecrets } from "./secrets.js";

export const JOURNAL_SCHEMA_VERSION = 1 as const;

export type JournalEventType =
  | "task_created"
  | "state_changed"
  | "provider_selected"
  | "tool_invoked"
  | "tool_result"
  | "policy_decision"
  | "verification"
  | "checkpoint"
  | "resumed"
  | "error"
  | "completed";

export interface JournalEvent {
  schema: typeof JOURNAL_SCHEMA_VERSION;
  seq: number;
  ts: string;
  taskId: string;
  type: JournalEventType;
  payload: Record<string, unknown>;
}

const STRIP_KEYS = new Set([
  "apikey",
  "apitoken",
  "authorization",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "authtoken",
  "token",
  "password",
  "passwd",
  "secret",
  "clientsecret",
  "secretkey",
  "credentials",
  "cookie",
  "setcookie",
  "thought",
  "chainofthought",
  "privatethought",
  "reasoning",
]);

function shouldStripKey(key: string): boolean {
  return STRIP_KEYS.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase());
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (shouldStripKey(key)) continue;
      out[key] = sanitizeValue(child);
    }
    return out;
  }
  return value;
}

export class TaskJournal {
  #events: JournalEvent[] = [];
  #seq = 0;

  constructor(events: readonly JournalEvent[] = []) {
    this.#events = events.map((event) => ({
      ...event,
      payload: sanitizeValue(event.payload) as Record<string, unknown>,
    }));
    this.#seq = events.reduce((max, event) => Math.max(max, event.seq), 0);
  }

  get events(): readonly JournalEvent[] {
    return this.#events;
  }

  append(
    taskId: string,
    type: JournalEventType,
    payload: Record<string, unknown>,
    now = new Date(),
  ): JournalEvent {
    const event: JournalEvent = {
      schema: JOURNAL_SCHEMA_VERSION,
      seq: ++this.#seq,
      ts: now.toISOString(),
      taskId,
      type,
      payload: sanitizeValue(payload) as Record<string, unknown>,
    };
    this.#events.push(event);
    return event;
  }

  forTask(taskId: string): JournalEvent[] {
    return this.#events.filter((event) => event.taskId === taskId);
  }

  lastCheckpoint(taskId: string): JournalEvent | undefined {
    return [...this.forTask(taskId)].reverse().find((event) => event.type === "checkpoint");
  }

  canResume(taskId: string): boolean {
    const events = this.forTask(taskId);
    if (events.length === 0) return false;
    const last = events[events.length - 1];
    return last?.type !== "completed";
  }

  static replay(events: readonly JournalEvent[]): TaskJournal {
    const valid = events.filter((event) => event.schema === JOURNAL_SCHEMA_VERSION);
    return new TaskJournal(valid);
  }
}
