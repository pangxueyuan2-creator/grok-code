/**
 * Task domain model. A Task is the human-facing unit of work: one user request
 * becomes one task that progresses through observable states and dynamic steps.
 */

export const TASK_STATES = [
  "QUEUED",
  "UNDERSTANDING",
  "WORKING",
  "WAITING_PERMISSION",
  "TESTING",
  "VERIFYING",
  "BLOCKED",
  "DONE",
  "DONE_WITH_WARNINGS",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

export type StepState = "pending" | "in_progress" | "done" | "failed" | "skipped";

export interface TaskStep {
  /** Stable id within the task. */
  id: string;
  /** Human title, e.g. "找到认证代码". */
  title: string;
  state: StepState;
  /** Optional free-form detail shown in Pro Mode. */
  detail?: string;
}

export interface Task {
  /** UUID of the task (Grok Code's own id, distinct from the grok session id). */
  id: string;
  /** What the user asked for, verbatim. */
  request: string;
  state: TaskState;
  /** Dynamic execution steps. Updated as the task progresses. */
  steps: TaskStep[];
  /** The grok session this task runs in (real grok session persistence). */
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  /** Project directory the task runs in (resolved absolute path). */
  cwd: string;
}

/**
 * Allowed state transitions. The state machine is deliberately small so the UI
 * can explain it to a beginner: queued -> understanding -> working ->
 * (testing -> verifying ->) done.
 */
export const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  QUEUED: ["UNDERSTANDING", "CANCELLED"],
  UNDERSTANDING: ["WORKING", "BLOCKED", "FAILED", "CANCELLED"],
  WORKING: ["WAITING_PERMISSION", "TESTING", "BLOCKED", "DONE", "FAILED", "CANCELLED"],
  WAITING_PERMISSION: ["WORKING", "BLOCKED", "CANCELLED"],
  TESTING: ["WORKING", "VERIFYING", "BLOCKED", "FAILED", "CANCELLED"],
  VERIFYING: ["WORKING", "DONE", "DONE_WITH_WARNINGS", "BLOCKED", "FAILED", "CANCELLED"],
  BLOCKED: ["WORKING", "QUEUED", "CANCELLED"],
  DONE: [],
  DONE_WITH_WARNINGS: [],
  FAILED: [],
  CANCELLED: [],
};

/** Whether the state is a terminal (finished) state. */
export function isTerminal(state: TaskState): boolean {
  return TASK_TRANSITIONS[state].length === 0;
}

/** Whether the state means the user's request was satisfied. */
export function isSuccessful(state: TaskState): boolean {
  return state === "DONE" || state === "DONE_WITH_WARNINGS";
}

/**
 * Transition a task to a new state. Returns a new task with updated timestamp,
 * or throws if the transition is not allowed (programming error, not user error).
 */
export function transition(task: Task, to: TaskState, now = new Date()): Task {
  if (task.state === to) return task;
  if (!TASK_TRANSITIONS[task.state].includes(to)) {
    throw new Error(`Invalid task transition ${task.state} -> ${to}`);
  }
  return { ...task, state: to, updatedAt: now.toISOString() };
}

/** Apply a step update; steps are identified by id, order is preserved. */
export function updateStep(
  task: Task,
  step: Partial<TaskStep> & { id: string },
  now = new Date(),
): Task {
  const idx = task.steps.findIndex((s) => s.id === step.id);
  if (idx === -1) {
    const next: TaskStep = {
      id: step.id,
      title: step.title ?? step.id,
      state: step.state ?? "pending",
      detail: step.detail,
    };
    return { ...task, steps: [...task.steps, next], updatedAt: now.toISOString() };
  }
  const steps = task.steps.slice();
  const current = steps[idx];
  if (current === undefined) throw new Error("unreachable");
  steps[idx] = { ...current, ...step };
  return { ...task, steps, updatedAt: now.toISOString() };
}

/**
 * Suggest a first-pass step plan for a request. This is NOT a promise that the
 * model will follow it — it seeds the visible checklist and gets adjusted as
 * the agent works.
 */
export function seedSteps(request: string): TaskStep[] {
  const base: TaskStep[] = [
    { id: "understand", title: "理解项目", state: "pending" },
    { id: "locate", title: "找到相关代码", state: "pending" },
    { id: "implement", title: "实现修改", state: "pending" },
    { id: "test", title: "测试", state: "pending" },
    { id: "verify", title: "验证", state: "pending" },
  ];
  const looksLikeInvestigation =
    /检查|审查|review|explain|理解|分析|看看|有没有问题|是什么/i.test(request);
  if (looksLikeInvestigation) {
    return base.filter((s) => s.id !== "implement");
  }
  return base;
}

export function createTask(
  id: string,
  request: string,
  cwd: string,
  now = new Date(),
): Task {
  return {
    id,
    request,
    state: "QUEUED",
    steps: seedSteps(request),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    cwd,
  };
}
