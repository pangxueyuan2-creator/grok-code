import { describe, expect, it } from "vitest";
import {
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
