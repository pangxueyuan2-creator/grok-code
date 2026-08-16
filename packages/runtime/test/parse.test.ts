import { describe, expect, it } from "vitest";
import { parseStreamLine, reduceActivities } from "../src/parse.js";
import { buildHeadlessArgs, HARD_DENY_RULES, permissionFlags } from "../src/args.js";

describe("parseStreamLine", () => {
  it("parses text, thought, tool lifecycle, end", () => {
    const acts = [
      ...parseStreamLine('{"type":"thought","data":"thinking..."}'),
      ...parseStreamLine(
        '{"type":"tool_call","toolCallId":"c1","title":"Read","kind":"read","status":"in_progress","toolName":"read_file","rawInput":{"path":"a.ts"},"content":[],"locations":[]}',
      ),
      ...parseStreamLine(
        '{"type":"tool_call_update","toolCallId":"c1","status":"completed","rawOutput":{"lines":42}}',
      ),
      ...parseStreamLine('{"type":"text","data":"done"}'),
      ...parseStreamLine(
        '{"type":"end","stopReason":"end_turn","sessionId":"s1","num_turns":3,"usage":{"input_tokens":1}}',
      ),
    ];
    expect(acts.map((a) => a.type)).toEqual([
      "thought",
      "tool_start",
      "tool_update",
      "text",
      "end",
    ]);
    const end = acts.at(-1);
    expect(end?.type).toBe("end");
  });

  it("maps tool ids to friendly categories", () => {
    const acts = parseStreamLine(
      '{"type":"tool_call","toolCallId":"c2","title":"Bash","kind":"bash","status":"in_progress","toolName":"run_terminal_cmd","rawInput":{"command":"npm test"}}',
    );
    expect(acts[0]?.type).toBe("tool_start");
    if (acts[0]?.type === "tool_start") {
      expect(acts[0].category).toBe("COMMAND");
    }
  });

  it("turns bad JSON into an error activity instead of throwing", () => {
    const acts = parseStreamLine("this is not json {");
    expect(acts).toEqual([{ type: "error", message: expect.stringContaining("无法解析") }]);
  });

  it("ignores unknown event types forward-compatibly", () => {
    expect(parseStreamLine('{"type":"auto_compact_start"}')).toEqual([]);
  });

  it("handles tool_call that is already completed (start+update)", () => {
    const acts = parseStreamLine(
      '{"type":"tool_call","toolCallId":"c3","status":"completed","toolName":"grep","rawInput":{},"rawOutput":{}}',
    );
    expect(acts.map((a) => a.type)).toEqual(["tool_start", "tool_update"]);
  });
});

describe("reduceActivities", () => {
  it("accumulates text and returns session summary", () => {
    const summary = reduceActivities(
      [
        { type: "text", data: "Hello " },
        { type: "text", data: "world" },
        {
          type: "end",
          stopReason: "end_turn",
          sessionId: "s-1",
          numTurns: 2,
          usage: { total_tokens: 10 },
        },
      ],
      false,
    );
    expect(summary.text).toBe("Hello world");
    expect(summary.sessionId).toBe("s-1");
    expect(summary.stopReason).toBe("end_turn");
    expect(summary.numTurns).toBe(2);
  });
});

describe("buildHeadlessArgs", () => {
  it("always includes hard deny rules", () => {
    const args = buildHeadlessArgs({ prompt: "hi", cwd: "C:/x", mode: "FULL" });
    expect(args).toContain("--permission-mode");
    const denyIdx = args.indexOf("--deny");
    expect(denyIdx).toBeGreaterThan(0);
    for (const rule of HARD_DENY_RULES) {
      expect(args.slice(denyIdx + 1)).toContain(rule);
    }
  });

  it("SAFE mode denies write-heavy prefixes on top of hard denies", () => {
    const args = buildHeadlessArgs({ prompt: "hi", cwd: "/x", mode: "SAFE" });
    expect(args).toContain("Bash(git push*)");
  });

  it("supports resume flags", () => {
    const args = buildHeadlessArgs({
      prompt: "continue",
      cwd: "/x",
      resumeId: "abc",
      maxTurns: 5,
    });
    expect(args).toContain("-r");
    expect(args[args.indexOf("-r") + 1]).toBe("abc");
    expect(args).toContain("5");
  });

  it("maps modes to grok permission modes", () => {
    expect(permissionFlags("SAFE").permissionMode).toBe("default");
    expect(permissionFlags("AUTO").permissionMode).toBe("auto");
    expect(permissionFlags("FULL").permissionMode).toBe("bypassPermissions");
  });
});
