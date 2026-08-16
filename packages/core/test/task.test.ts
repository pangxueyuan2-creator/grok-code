import { describe, expect, it } from "vitest";
import {
  TASK_TRANSITIONS,
  createTask,
  isSuccessful,
  isTerminal,
  seedSteps,
  transition,
  updateStep,
} from "../src/task.js";

describe("task state machine", () => {
  it("follows the happy path", () => {
    let t = createTask("t1", "添加登录", "C:/proj");
    expect(t.state).toBe("QUEUED");
    t = transition(t, "UNDERSTANDING");
    t = transition(t, "WORKING");
    t = transition(t, "TESTING");
    t = transition(t, "VERIFYING");
    t = transition(t, "DONE");
    expect(t.state).toBe("DONE");
    expect(isTerminal(t.state)).toBe(true);
    expect(isSuccessful(t.state)).toBe(true);
  });

  it("allows WAITING_PERMISSION only from WORKING", () => {
    let t = createTask("t2", "x", "/p");
    expect(() => transition(t, "WAITING_PERMISSION")).toThrow(/Invalid task transition/);
    t = transition(t, "UNDERSTANDING");
    t = transition(t, "WORKING");
    t = transition(t, "WAITING_PERMISSION");
    expect(t.state).toBe("WAITING_PERMISSION");
    t = transition(t, "WORKING");
    expect(t.state).toBe("WORKING");
  });

  it("allows DONE_WITH_WARNINGS from VERIFYING", () => {
    let t = createTask("t3", "x", "/p");
    for (const s of ["UNDERSTANDING", "WORKING", "TESTING", "VERIFYING"] as const) {
      t = transition(t, s);
    }
    t = transition(t, "DONE_WITH_WARNINGS");
    expect(isSuccessful(t.state)).toBe(true);
  });

  it("rejects transitions to non-existent states at type level and runtime", () => {
    let t = createTask("t4", "x", "/p");
    t = transition(t, "UNDERSTANDING");
    expect(() => transition(t, "DONE")).toThrow(/Invalid task transition/);
  });

  it("terminal states have no outgoing transitions", () => {
    for (const s of ["DONE", "DONE_WITH_WARNINGS", "FAILED", "CANCELLED"] as const) {
      expect(TASK_TRANSITIONS[s]).toEqual([]);
      expect(isTerminal(s)).toBe(true);
    }
  });

  it("same-state transition is a no-op", () => {
    const t = createTask("t5", "x", "/p");
    expect(transition(t, "QUEUED")).toBe(t);
  });
});

describe("steps", () => {
  it("seeds a checklist for implementation requests", () => {
    const steps = seedSteps("给这个页面增加登录");
    expect(steps.map((s) => s.id)).toEqual([
      "understand",
      "locate",
      "implement",
      "test",
      "verify",
    ]);
  });

  it("seeds an investigation checklist without implement", () => {
    const steps = seedSteps("帮我看看这个项目是做什么的");
    expect(steps.map((s) => s.id)).not.toContain("implement");
  });

  it("updates existing steps by id and appends new ones", () => {
    let t = createTask("t6", "x", "/p");
    t = updateStep(t, { id: "understand", state: "done" });
    t = updateStep(t, { id: "custom", title: "自定义步骤", state: "in_progress" });
    const ids = t.steps.map((s) => s.id);
    expect(ids).toContain("custom");
    expect(t.steps.find((s) => s.id === "understand")?.state).toBe("done");
    expect(t.steps).toHaveLength(6);
  });
});
