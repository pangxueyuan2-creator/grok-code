import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
  TaskJournal,
  canMarkCompleted,
  type Activity,
  type JournalEventType,
  type PermissionModeName,
  type VerificationResult,
} from "@grok-code/core";
import {
  JournalStore,
  runHeadless,
  verifyProject,
  type HeadlessResult,
  type RunHeadlessOptions,
} from "@grok-code/runtime";

export interface DispatchOptions {
  prompt: string;
  cwd: string;
  providerId: string;
  model?: string;
  mode: PermissionModeName;
  maxTurns?: number;
  timeoutMs?: number;
}

export interface DispatchDependencies {
  id?: () => string;
  now?: () => Date;
  store?: JournalStore;
  runHeadlessImpl?: (options: RunHeadlessOptions) => Promise<HeadlessResult>;
  verifyProjectImpl?: (cwd: string) => VerificationResult;
}

interface RecordedTask {
  taskId: string;
  journal: TaskJournal;
  store: JournalStore;
  now: () => Date;
  journalPath: string;
}

function newRecordedTask(
  taskId: string,
  store: JournalStore,
  now: () => Date,
): RecordedTask {
  return {
    taskId,
    journal: new TaskJournal(),
    store,
    now,
    journalPath: store.pathFor(taskId),
  };
}

function record(
  task: RecordedTask,
  type: JournalEventType,
  payload: Record<string, unknown>,
): void {
  task.store.append(task.journal.append(task.taskId, type, payload, task.now()));
}

function recordActivity(task: RecordedTask, activity: Activity): void {
  switch (activity.type) {
    case "tool_start":
      record(task, "tool_invoked", {
        toolCallId: activity.toolCallId,
        toolName: activity.toolName,
        category: activity.category,
        title: activity.title,
        input: activity.input,
      });
      break;
    case "tool_update":
      record(task, "tool_result", {
        toolCallId: activity.toolCallId,
        status: activity.status,
        output: activity.output ?? {},
        summary: activity.summary,
      });
      break;
    case "permission_required":
      record(task, "policy_decision", {
        toolCallId: activity.toolCallId,
        toolName: activity.toolName,
        command: activity.command,
        path: activity.path,
        verdict: "ask",
      });
      break;
    case "error":
      record(task, "error", { message: activity.message });
      break;
    case "end":
      record(task, "checkpoint", {
        phase: "provider_end",
        sessionId: activity.sessionId ?? task.taskId,
        stopReason: activity.stopReason,
        usage: activity.usage,
        numTurns: activity.numTurns,
      });
      break;
    case "thought":
      // Hidden/private reasoning is intentionally not persisted.
      break;
    default:
      break;
  }
}

function verificationSummary(result: VerificationResult): string {
  const passed = result.steps.filter((step) => step.status === "passed").length;
  const failed = result.steps.filter((step) => step.status === "failed").length;
  const unavailable = result.steps.filter((step) => step.status === "unavailable").length;
  if (result.steps.length === 0) return "no declared checks discovered";
  return `${passed} passed, ${failed} failed, ${unavailable} unavailable`;
}

function verificationPayload(result: VerificationResult): Record<string, unknown> {
  return {
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    steps: result.steps.map((step) => ({
      kind: step.kind,
      command: step.command,
      status: step.status,
      summary: step.summary,
      durationMs: step.durationMs,
      exitCode: step.exitCode,
    })),
  };
}

function renderResult(
  task: RecordedTask,
  result: HeadlessResult,
  verification: VerificationResult,
  status: "DONE" | "NEEDS_ATTENTION",
  reason: string,
): string {
  const lines = [
    `task:         ${task.taskId}`,
    `status:       ${status}`,
    `session:      ${result.summary.sessionId ?? task.taskId}`,
    `journal:      ${task.journalPath}`,
    `verification: ${verificationSummary(verification)}`,
    `reason:       ${reason}`,
    `tools:        ${result.summary.toolCalls.length}`,
  ];
  if (result.summary.text.trim()) {
    lines.push("", "assistant:", result.summary.text.trim());
  }
  return lines.join("\n");
}

async function executeRecordedRun(
  task: RecordedTask,
  runOptions: RunHeadlessOptions,
  cwd: string,
  deps: DispatchDependencies,
): Promise<string> {
  const run = deps.runHeadlessImpl ?? runHeadless;
  const verify = deps.verifyProjectImpl ?? verifyProject;

  let result: HeadlessResult;
  try {
    result = await run({
      ...runOptions,
      onActivity: (activity) => recordActivity(task, activity),
    });
  } catch (error) {
    record(task, "error", {
      message: error instanceof Error ? error.message : String(error),
      phase: "provider_run",
    });
    throw error;
  }

  const verification = verify(cwd);
  const gate = canMarkCompleted(verification);
  record(task, "verification", {
    ...verificationPayload(verification),
    gate: gate.ok,
    gateReason: gate.reason,
  });

  const providerOk = result.exitCode === 0 && result.summary.errors.length === 0 && !result.summary.timedOut;
  if (providerOk && gate.ok) {
    record(task, "completed", {
      state: "DONE",
      stopReason: result.summary.stopReason,
      verification: verificationSummary(verification),
    });
    return renderResult(task, result, verification, "DONE", gate.reason);
  }

  const reason = !providerOk
    ? `Provider execution did not finish cleanly (exit=${result.exitCode ?? "unknown"}, errors=${result.summary.errors.length}, timedOut=${result.summary.timedOut}).`
    : gate.reason;
  record(task, "error", { message: reason, phase: "completion_gate" });
  return renderResult(task, result, verification, "NEEDS_ATTENTION", reason);
}

export async function dispatchTask(
  options: DispatchOptions,
  deps: DispatchDependencies = {},
): Promise<string> {
  if (options.providerId !== "xai") {
    throw new Error(
      `Provider ${options.providerId} has an inference adapter, but autonomous coding-tool dispatch is not implemented yet. Use --provider xai for the Grok Build execution path, or use forgepilot plan to inspect routing.`,
    );
  }

  const taskId = (deps.id ?? randomUUID)();
  const now = deps.now ?? (() => new Date());
  const store = deps.store ?? new JournalStore();
  const task = newRecordedTask(taskId, store, now);
  const cwd = resolve(options.cwd);

  record(task, "task_created", { request: options.prompt, cwd });
  record(task, "provider_selected", {
    providerId: "xai",
    runtime: "grok-build",
    model: options.model,
  });
  record(task, "checkpoint", {
    phase: "session_bound",
    sessionId: taskId,
    cwd,
    mode: options.mode,
    model: options.model,
    request: options.prompt,
  });

  return executeRecordedRun(
    task,
    {
      prompt: options.prompt,
      cwd,
      mode: options.mode,
      model: options.model,
      sessionId: taskId,
      maxTurns: options.maxTurns,
      timeoutMs: options.timeoutMs,
      outputFormat: "streaming-json",
    },
    cwd,
    deps,
  );
}

export async function resumeTask(
  taskId: string,
  deps: DispatchDependencies = {},
): Promise<string> {
  const now = deps.now ?? (() => new Date());
  const store = deps.store ?? new JournalStore();
  const journal = store.load(taskId);
  if (!journal) throw new Error(`No persisted journal found for task ${taskId}.`);
  if (!journal.canResume(taskId)) return `Task ${taskId} already finished.`;

  const created = journal.events.find((event) => event.type === "task_created");
  const checkpoint = [...journal.events]
    .reverse()
    .find((event) => event.type === "checkpoint" && event.payload["phase"] === "session_bound");
  if (!created || !checkpoint) {
    throw new Error(`Task ${taskId} is missing the durable session checkpoint required for resume.`);
  }

  const request = String(created.payload["request"] ?? "");
  const cwd = resolve(String(checkpoint.payload["cwd"] ?? process.cwd()));
  const mode = String(checkpoint.payload["mode"] ?? "AUTO") as PermissionModeName;
  const model = checkpoint.payload["model"] ? String(checkpoint.payload["model"]) : undefined;
  const sessionId = String(checkpoint.payload["sessionId"] ?? taskId);
  const task: RecordedTask = {
    taskId,
    journal,
    store,
    now,
    journalPath: store.pathFor(taskId),
  };

  record(task, "resumed", { sessionId, cwd });
  return executeRecordedRun(
    task,
    {
      prompt: `Continue the previous task and address any remaining verification failures. Original request: ${request}`,
      cwd,
      mode,
      model,
      resumeId: sessionId,
      outputFormat: "streaming-json",
    },
    cwd,
    deps,
  );
}
