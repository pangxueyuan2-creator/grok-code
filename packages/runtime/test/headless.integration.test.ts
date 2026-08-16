import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runHeadless } from "../src/headless.js";
import { probeGrok } from "../src/discover.js";

const here = dirname(fileURLToPath(import.meta.url));
const fake = join(here, "fixtures", "fake-grok.mjs");
const nodeBin = process.execPath;

const fakeEnv = (scenario: string): NodeJS.ProcessEnv => ({
  ...process.env,
  GROK_FAKE_SCENARIO: scenario,
});

describe("runHeadless with fake grok", () => {
  it("runs a canned session end-to-end", async () => {
    const result = await runHeadless({
      prompt: "test",
      cwd: process.cwd(),
      mode: "FULL",
      binary: nodeBin,
      binaryArgs: [fake],
      maxTurns: 2,
      ioMode: "auto",
      env: fakeEnv("ok"),
    });
    expect(result.summary.sessionId).toBe("fake-session-1");
    expect(result.summary.text).toContain("已完成");
    expect(result.summary.toolCalls).toHaveLength(1);
    expect(result.exitCode).toBe(0);
    expect(result.activities.some((a) => a.type === "tool_start")).toBe(true);
  }, 30000);

  it("captures errors and non-zero exit", async () => {
    const result = await runHeadless({
      prompt: "test",
      cwd: process.cwd(),
      mode: "AUTO",
      binary: nodeBin,
      binaryArgs: [fake],
      ioMode: "auto",
      env: fakeEnv("error"),
    });
    expect(result.summary.errors.length).toBeGreaterThan(0);
    expect(result.exitCode).toBe(1);
  }, 30000);

  it("survives garbage lines", async () => {
    const result = await runHeadless({
      prompt: "test",
      cwd: process.cwd(),
      mode: "AUTO",
      binary: nodeBin,
      binaryArgs: [fake],
      ioMode: "auto",
      env: fakeEnv("bad-json"),
    });
    expect(result.summary.sessionId).toBe("fake-session-1");
  }, 30000);

  it("reports timeout without throwing", async () => {
    const result = await runHeadless({
      prompt: "test",
      cwd: process.cwd(),
      mode: "AUTO",
      binary: nodeBin,
      binaryArgs: [fake],
      ioMode: "auto",
      env: fakeEnv("slow"),
      timeoutMs: 1500,
    });
    expect(result.summary.timedOut).toBe(true);
    expect(result.summary.text).toContain("still working");
  }, 30000);
});

describe("probeGrok with fake grok", () => {
  it("reports version and models", () => {
    const info = probeGrok({ binary: nodeBin, binaryArgs: [fake], env: fakeEnv("ok") });
    expect(info.found).toBe(true);
    expect(info.version).toBe("1.0.4");
    expect(info.models).toContain("grok-4.6");
  });
});
