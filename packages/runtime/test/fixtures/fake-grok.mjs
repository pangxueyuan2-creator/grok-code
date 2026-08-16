#!/usr/bin/env node
// Fake grok for unit tests. Reads GROK_FAKE_SCENARIO to pick canned behavior.
const scenario = process.env.GROK_FAKE_SCENARIO ?? "ok";
const delay = Number(process.env.GROK_FAKE_DELAY ?? "0");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv.includes("--version")) {
  console.log("grok 1.0.4 (f4k3sha) [stable]");
  process.exit(0);
}

if (process.argv.includes("models")) {
  console.log("Default model: grok-4.6\nAvailable models:\n  * grok-4.6 (default)\n  - grok-4.3");
  process.exit(0);
}

const emit = (obj) => console.log(JSON.stringify(obj));

if (scenario === "ok") {
  emit({ type: "thought", data: "thinking..." });
  emit({
    type: "tool_call",
    toolCallId: "call_1",
    title: "Read",
    kind: "read",
    status: "in_progress",
    toolName: "read_file",
    rawInput: { path: "src/main.ts" },
    content: [],
    locations: [],
  });
  emit({
    type: "tool_call_update",
    toolCallId: "call_1",
    status: "completed",
    content: [],
    rawOutput: { lines: 12 },
    locations: [],
  });
  emit({ type: "text", data: "已完成。" });
  emit({ type: "end", stopReason: "end_turn", sessionId: "fake-session-1", requestId: "req_1", num_turns: 1, usage: { input_tokens: 100, output_tokens: 20 } });
  await sleep(delay);
  process.exit(0);
} else if (scenario === "error") {
  emit({ type: "text", data: "开始" });
  emit({ type: "error", message: "Couldn't start session" });
  await sleep(delay);
  process.exit(1);
} else if (scenario === "slow") {
  emit({ type: "text", data: "still working" });
  await sleep(30000);
  process.exit(0);
} else if (scenario === "bad-json") {
  console.log("this is not json {");
  emit({ type: "end", stopReason: "end_turn", sessionId: "fake-session-1" });
  process.exit(0);
} else {
  emit({ type: "text", data: "empty" });
  process.exit(0);
}
