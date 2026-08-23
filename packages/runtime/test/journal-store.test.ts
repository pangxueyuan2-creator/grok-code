import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TaskJournal } from "@grok-code/core";
import { JournalStore } from "../src/journal-store.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("JournalStore", () => {
  it("persists and replays append-only task events", () => {
    const root = mkdtempSync(join(tmpdir(), "forgepilot-journal-"));
    roots.push(root);
    const store = new JournalStore(root);
    const journal = new TaskJournal();

    store.append(journal.append("task-1", "task_created", { request: "fix it" }));
    store.append(journal.append("task-1", "checkpoint", { sessionId: "task-1" }));

    const loaded = store.load("task-1");
    expect(loaded?.events).toHaveLength(2);
    expect(loaded?.events[1]?.type).toBe("checkpoint");
    expect(loaded?.canResume("task-1")).toBe(true);
  });

  it("stores sanitized journal payloads rather than raw credentials", () => {
    const root = mkdtempSync(join(tmpdir(), "forgepilot-journal-"));
    roots.push(root);
    const store = new JournalStore(root);
    const journal = new TaskJournal();

    store.append(
      journal.append("task-2", "provider_selected", {
        apiKey: "sk-this-should-never-be-written",
        apiKeyEnv: "OPENAI_API_KEY",
      }),
    );

    const raw = readFileSync(store.pathFor("task-2"), "utf8");
    expect(raw).toContain("OPENAI_API_KEY");
    expect(raw).not.toContain("sk-this-should-never-be-written");
  });

  it("fails closed on corrupt journal lines", () => {
    const root = mkdtempSync(join(tmpdir(), "forgepilot-journal-"));
    roots.push(root);
    const store = new JournalStore(root);
    writeFileSync(store.pathFor("task-3"), "not-json\n", { encoding: "utf8", flag: "w" });
    expect(() => store.load("task-3")).toThrow(/Corrupt journal/);
  });
});
