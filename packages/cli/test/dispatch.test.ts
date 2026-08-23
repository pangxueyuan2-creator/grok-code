import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VerificationResult } from "@grok-code/core";
import { JournalStore, type HeadlessResult, type RunHeadlessOptions } from "@grok-code/runtime";
import { dispatchTask, resumeTask } from "../src/dispatch.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempStore(): JournalStore {
  const root = mkdtempSync(join(tmpdir(), "forgepilot-dispatch-"));
  roots.push(root);
  return new JournalStore(root);
}

function cleanResult(sessionId: string, text = "done"): HeadlessResult {
  return {
    activities: [],
    summary: {
      text,
      sessionId,
      stopReason: "end_turn",
      usage: {},
      errors: [],
      toolCalls: [{ id: "tool-1", name: "write_file", status: "completed" }],
      timedOut: false,
    },
    exitCode: 0,
    durationMs: 12,
    ioMode: "pipe",
  };
}

function passedVerification(): VerificationResult {
  return {
    startedAt: "2026-08-23T00:00:00.000Z",
    finishedAt: "2026-08-23T00:00:01.000Z",
    steps: [
      {
        kind: "test",
        command: "pnpm run test",
        status: "passed",
        summary: "passed",
        exitCode: 0,
      },
    ],
  };
}

function noVerification(): VerificationResult {
  return {
    startedAt: "2026-08-23T00:00:00.000Z",
    finishedAt: "2026-08-23T00:00:00.000Z",
    steps: [],
  };
}

describe("dispatchTask", () => {
  it("executes Grok Build, persists tool events, and only reports DONE after verification", async () => {
    const store = tempStore();
    const runHeadlessImpl = vi.fn(async (options: RunHeadlessOptions) => {
      options.onActivity?.({
        type: "tool_start",
        toolCallId: "tool-1",
        toolName: "write_file",
        category: "WRITE",
        title: "Write file",
        input: { path: "src/app.ts" },
      });
      options.onActivity?.({
        type: "thought",
        data: "private reasoning that must not be persisted",
      });
      options.onActivity?.({
        type: "tool_update",
        toolCallId: "tool-1",
        status: "completed",
        summary: "wrote file",
      });
      options.onActivity?.({ type: "end", stopReason: "end_turn", sessionId: "task-123" });
      return cleanResult("task-123", "implemented");
    });

    const out = await dispatchTask(
      {
        prompt: "Fix the tests",
        cwd: process.cwd(),
        providerId: "xai",
        mode: "AUTO",
      },
      {
        id: () => "task-123",
        store,
        runHeadlessImpl,
        verifyProjectImpl: passedVerification,
      },
    );

    expect(out).toContain("status:       DONE");
    expect(runHeadlessImpl).toHaveBeenCalledOnce();
    expect(runHeadlessImpl.mock.calls[0]?.[0].sessionId).toBe("task-123");
    const loaded = store.load("task-123");
    expect(loaded?.events.some((event) => event.type === "tool_invoked")).toBe(true);
    expect(loaded?.events.at(-1)?.type).toBe("completed");
    expect(JSON.stringify(loaded?.events)).not.toContain("private reasoning");
  });

  it("keeps the task resumable when no independent checks can verify completion", async () => {
    const store = tempStore();
    const out = await dispatchTask(
      {
        prompt: "Change something",
        cwd: process.cwd(),
        providerId: "xai",
        mode: "SAFE",
      },
      {
        id: () => "task-unverified",
        store,
        runHeadlessImpl: async () => cleanResult("task-unverified"),
        verifyProjectImpl: noVerification,
      },
    );

    expect(out).toContain("status:       NEEDS_ATTENTION");
    expect(out).toContain("no declared checks discovered");
    expect(store.load("task-unverified")?.canResume("task-unverified")).toBe(true);
  });

  it("resumes the fixed Grok session from the durable checkpoint", async () => {
    const store = tempStore();
    await dispatchTask(
      {
        prompt: "Finish the feature",
        cwd: process.cwd(),
        providerId: "xai",
        mode: "AUTO",
      },
      {
        id: () => "task-resume",
        store,
        runHeadlessImpl: async () => cleanResult("task-resume"),
        verifyProjectImpl: noVerification,
      },
    );

    const resumedRun = vi.fn(async (options: RunHeadlessOptions) => cleanResult(options.resumeId ?? "missing", "fixed"));
    const out = await resumeTask("task-resume", {
      store,
      runHeadlessImpl: resumedRun,
      verifyProjectImpl: passedVerification,
    });

    expect(resumedRun.mock.calls[0]?.[0].resumeId).toBe("task-resume");
    expect(out).toContain("status:       DONE");
    expect(store.load("task-resume")?.events.at(-1)?.type).toBe("completed");
  });

  it("refuses to pretend direct-provider inference adapters can autonomously edit code", async () => {
    await expect(
      dispatchTask({
        prompt: "Fix it",
        cwd: process.cwd(),
        providerId: "openai",
        mode: "AUTO",
      }),
    ).rejects.toThrow(/tool dispatch is not implemented/);
  });
});
