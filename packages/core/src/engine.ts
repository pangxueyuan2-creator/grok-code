import { addChange, emptySummary, type ChangeSummary, type FileChange } from "./change.js";
import { TaskJournal, type JournalEvent } from "./journal.js";
import { evaluatePolicy, type PermissionModeName, type PolicyDecision } from "./policy.js";
import type { ProviderRegistry } from "./provider.js";
import { bindTaskProvider, selectProvider } from "./routing.js";
import { createTask, transition, updateStep, withProvider, type Task } from "./task.js";
import { canMarkCompleted, type VerificationResult } from "./verify.js";

export interface ScriptedAction {
  toolName: string;
  title: string;
  command?: string;
  path?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  summary: string;
  change?: FileChange;
}

export interface EngineInput {
  request: string;
  cwd: string;
  providerId: string;
  model?: string;
  allowFallback: boolean;
  allowRemote: boolean;
  mode: PermissionModeName;
  planText?: string;
  actions: ScriptedAction[];
  verification: VerificationResult;
}

export interface EngineHooks {
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  onEvent?: (event: JournalEvent, task: Task) => void;
  signal?: AbortSignal;
}

export interface EngineResult {
  task: Task;
  journal: TaskJournal;
  changes: ChangeSummary;
  denied: PolicyDecision[];
  verification: VerificationResult | undefined;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function tick(hooks: EngineHooks, ms: number): Promise<void> {
  if (hooks.signal?.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }
  await (hooks.sleep ?? ((n) => new Promise((r) => setTimeout(r, n))))(ms);
}

export async function runEngine(
  registry: ProviderRegistry,
  input: EngineInput,
  journal = new TaskJournal(),
  hooks: EngineHooks = {},
): Promise<EngineResult> {
  const now = hooks.now ?? (() => new Date());
  const emit = (task: Task, type: JournalEvent["type"], payload: Record<string, unknown>) => {
    const event = journal.append(task.id, type, payload, now());
    hooks.onEvent?.(event, task);
    return task;
  };

  const binding = bindTaskProvider(registry, {
    providerId: input.providerId,
    model: input.model,
    allowFallback: input.allowFallback,
    allowRemote: input.allowRemote,
  });
  const profile = selectProvider(registry, binding);

  let task = withProvider(createTask(newId(), input.request, input.cwd, now()), binding, now());
  emit(task, "task_created", { request: task.request, cwd: task.cwd });
  emit(task, "provider_selected", {
    providerId: profile.id,
    kind: profile.kind,
    protocol: profile.protocol,
    model: profile.model,
    apiKeyEnv: profile.apiKeyEnv,
    baseUrl: profile.baseUrl,
  });

  task = transition(task, "UNDERSTANDING", now());
  task = updateStep(task, { id: "understand", state: "in_progress" }, now());
  emit(task, "state_changed", { state: task.state });
  await tick(hooks, 220);
  if (input.planText) {
    emit(task, "checkpoint", { phase: "plan", text: input.planText });
  }
  task = updateStep(task, { id: "understand", state: "done" }, now());

  task = transition(task, "WORKING", now());
  task = updateStep(task, { id: "locate", state: "in_progress" }, now());
  emit(task, "state_changed", { state: task.state });

  let changes = emptySummary();
  const denied: PolicyDecision[] = [];
  let toolIndex = 0;

  for (const action of input.actions) {
    await tick(hooks, 160);
    const decision = evaluatePolicy({
      mode: input.mode,
      toolName: action.toolName,
      command: action.command,
      path: action.path,
    });
    emit(task, "policy_decision", {
      toolName: action.toolName,
      command: action.command,
      verdict: decision.verdict,
      risk: decision.risk.level,
      reason: decision.reason,
      failClosed: decision.failClosed,
    });

    if (decision.verdict === "deny") {
      denied.push(decision);
      emit(task, "tool_result", {
        toolName: action.toolName,
        status: "denied",
        summary: decision.reason,
      });
      continue;
    }

    if (decision.verdict === "ask") {
      task = transition(task, "WAITING_PERMISSION", now());
      emit(task, "state_changed", { state: task.state });
      await tick(hooks, 180);
      task = transition(task, "WORKING", now());
      emit(task, "state_changed", { state: task.state, note: "operator approved" });
    }

    const toolCallId = `tool-${++toolIndex}`;
    emit(task, "tool_invoked", {
      toolCallId,
      toolName: action.toolName,
      title: action.title,
      input: action.input ?? { command: action.command, path: action.path },
    });
    await tick(hooks, 140);
    emit(task, "tool_result", {
      toolCallId,
      toolName: action.toolName,
      status: "completed",
      summary: action.summary,
      output: action.output ?? {},
    });
    if (action.change) {
      changes = addChange(changes, action.change);
    }

    if (action.toolName === "read_file" || action.toolName === "grep" || action.toolName === "list_dir") {
      task = updateStep(task, { id: "locate", state: "done" }, now());
      task = updateStep(task, { id: "implement", state: "in_progress" }, now());
    }
    if (action.toolName === "search_replace" || action.toolName === "write_file") {
      task = updateStep(task, { id: "implement", state: "done" }, now());
    }
  }

  task = updateStep(task, { id: "locate", state: "done" }, now());
  task = updateStep(task, { id: "implement", state: task.steps.some((s) => s.id === "implement") ? "done" : "skipped" }, now());
  task = transition(task, "TESTING", now());
  task = updateStep(task, { id: "test", state: "in_progress" }, now());
  emit(task, "state_changed", { state: task.state });
  await tick(hooks, 200);
  task = updateStep(task, { id: "test", state: "done" }, now());

  task = transition(task, "VERIFYING", now());
  task = updateStep(task, { id: "verify", state: "in_progress" }, now());
  emit(task, "state_changed", { state: task.state });
  await tick(hooks, 200);

  const gate = canMarkCompleted(input.verification);
  emit(task, "verification", {
    ...input.verification,
    gate: gate.ok,
    gateReason: gate.reason,
  });

  if (!gate.ok) {
    task = updateStep(task, { id: "verify", state: "failed", detail: gate.reason }, now());
    task = transition(task, "FAILED", now());
    emit(task, "error", { message: gate.reason });
    emit(task, "state_changed", { state: task.state });
    return { task, journal, changes, denied, verification: input.verification };
  }

  task = updateStep(task, { id: "verify", state: "done", detail: gate.reason }, now());
  task = transition(task, denied.length > 0 ? "DONE_WITH_WARNINGS" : "DONE", now());
  emit(task, "completed", { state: task.state, files: changes.files, denied: denied.length });
  emit(task, "state_changed", { state: task.state });
  return { task, journal, changes, denied, verification: input.verification };
}

export function resumeHint(journal: TaskJournal, taskId: string): string {
  if (!journal.canResume(taskId)) return "Task already finished.";
  const checkpoint = journal.lastCheckpoint(taskId);
  return checkpoint
    ? `Resume from checkpoint seq ${checkpoint.seq} (${checkpoint.ts}).`
    : "Resume from last journal event.";
}
