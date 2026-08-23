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
  id: string;
  title: string;
  state: StepState;
  detail?: string;
}

/** Task-level provider binding. Model may override the profile default. */
export interface TaskProviderBinding {
  readonly providerId: string;
  readonly model: string;
  /** When false, the engine must not switch providers after a failure. */
  readonly allowFallback: boolean;
  /** When false, only loopback/local endpoints may be used. */
  readonly allowRemote: boolean;
}

export interface Task {
  id: string;
  request: string;
  state: TaskState;
  steps: TaskStep[];
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  provider?: TaskProviderBinding;
}

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

export function isTerminal(state: TaskState): boolean {
  return TASK_TRANSITIONS[state].length === 0;
}

export function isSuccessful(state: TaskState): boolean {
  return state === "DONE" || state === "DONE_WITH_WARNINGS";
}

export function transition(task: Task, to: TaskState, now = new Date()): Task {
  if (task.state === to) return task;
  if (!TASK_TRANSITIONS[task.state].includes(to)) {
    throw new Error(`Invalid task transition ${task.state} -> ${to}`);
  }
  return { ...task, state: to, updatedAt: now.toISOString() };
}

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

export function seedSteps(request: string): TaskStep[] {
  const base: TaskStep[] = [
    { id: "understand", title: "Understand the project", state: "pending" },
    { id: "locate", title: "Locate relevant code", state: "pending" },
    { id: "implement", title: "Implement the change", state: "pending" },
    { id: "test", title: "Run tests", state: "pending" },
    { id: "verify", title: "Independent verification", state: "pending" },
  ];
  const looksLikeInvestigation =
    /检查|审查|review|explain|理解|分析|看看|有没有问题|是什么/i.test(request);
  if (looksLikeInvestigation) {
    return base.filter((s) => s.id !== "implement");
  }
  return base;
}

export function createTask(id: string, request: string, cwd: string, now = new Date()): Task {
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

export function withProvider(task: Task, provider: TaskProviderBinding, now = new Date()): Task {
  return { ...task, provider, updatedAt: now.toISOString() };
}
