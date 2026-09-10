import { describe, expect, it } from "vitest";
import {
  JOURNAL_SCHEMA_VERSION,
  TaskJournal,
  bindTaskProvider,
  canMarkCompleted,
  checkInstallProvenance,
  createBuiltinRegistry,
  evaluatePolicy,
  exportRedactedBundle,
  importBundle,
  resolveFallback,
  runEngine,
  serializeBundle,
  RoutingError,
} from "../src/index.js";

describe("ForgePilot control plane", () => {
  it("never silently falls back", () => {
    const registry = createBuiltinRegistry();
    const binding = bindTaskProvider(registry, {
      providerId: "xai",
      allowFallback: false,
      allowRemote: true,
    });
    expect(() =>
      resolveFallback(registry, binding, { timeoutMs: 1, maxRetries: 0, fallbackProviderIds: ["openai"] }, "xai"),
    ).toThrow(RoutingError);
  });

  it("fail-closes critical commands in FULL", () => {
    const decision = evaluatePolicy({ mode: "FULL", toolName: "run_terminal_cmd", command: "rm -rf /" });
    expect(decision.verdict).toBe("deny");
    expect(decision.failClosed).toBe(true);
  });

  it("strips secrets and hidden thoughts from the journal", () => {
    const event = new TaskJournal().append("t1", "tool_result", {
      thought: "hidden",
      apiKey: "sk-this-must-not-survive",
      summary: "token sk-abcdefghijklmnopqrstuvwxyz",
    });
    expect(event.payload.thought).toBeUndefined();
    expect(event.payload.apiKey).toBeUndefined();
    expect(String(event.payload.summary)).toMatch(/redacted/);
  });

  it("strips credential key variants and sanitizes replayed journals", () => {
    const event = new TaskJournal().append("t1", "tool_result", {
      PASSWORD: "opaque-value-that-would-not-match-a-secret-pattern",
      client_secret: "another-opaque-value",
      "access-token": "third-opaque-value",
      nested: {
        Authorization: "custom-auth-value",
        secretary: "keep-me",
      },
      reasoningMode: "brief",
    });

    expect(event.payload).toEqual({
      nested: { secretary: "keep-me" },
      reasoningMode: "brief",
    });

    const replayed = TaskJournal.replay([
      {
        schema: JOURNAL_SCHEMA_VERSION,
        seq: 1,
        ts: "2026-09-10T00:00:00.000Z",
        taskId: "legacy",
        type: "tool_result",
        payload: {
          Password: "legacy-opaque-value",
          safe: "ok",
        },
      },
    ]);
    expect(replayed.events[0]?.payload).toEqual({ safe: "ok" });
  });

  it("refuses completion without verification", () => {
    expect(canMarkCompleted(undefined).ok).toBe(false);
  });

  it("refuses unpinned remote MCP installs", () => {
    expect(
      checkInstallProvenance({
        kind: "mcp",
        name: "evil",
        source: "https://example.com/mcp.tgz",
        pinned: false,
      }).ok,
    ).toBe(false);
  });

  it("runs a task through the independent gate", async () => {
    const registry = createBuiltinRegistry();
    const result = await runEngine(
      registry,
      {
        request: "Add health endpoint",
        cwd: "/tmp",
        providerId: "xai",
        allowFallback: false,
        allowRemote: true,
        mode: "AUTO",
        actions: [
          {
            toolName: "read_file",
            title: "Read",
            path: "package.json",
            summary: "ok",
          },
          {
            toolName: "run_terminal_cmd",
            title: "Danger",
            command: "sudo rm -rf /",
            summary: "denied",
          },
        ],
        verification: {
          startedAt: "t",
          finishedAt: "t",
          steps: [{ kind: "test", command: "pnpm test", status: "passed", summary: "ok" }],
        },
      },
      new TaskJournal(),
      { sleep: async () => undefined },
    );
    expect(result.task.state).toBe("DONE_WITH_WARNINGS");
    expect(result.denied.length).toBeGreaterThan(0);
    const json = serializeBundle(exportRedactedBundle(result.task, result.journal.events));
    expect(importBundle(json).task.id).toBe(result.task.id);
  });
});
