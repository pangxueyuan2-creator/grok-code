import { describe, expect, it } from "vitest";
import { summarize, type VerificationResult } from "../src/verify.js";

describe("verification summary", () => {
  const base: VerificationResult = {
    steps: [],
    startedAt: "2026-08-16T00:00:00Z",
    finishedAt: "2026-08-16T00:00:01Z",
  };

  it("verifies only when something passed and nothing failed", () => {
    const ok = summarize({
      ...base,
      steps: [
        { kind: "test", command: "npm test", status: "passed", summary: "18 passed" },
        { kind: "typecheck", command: "tsc", status: "passed", summary: "ok" },
      ],
    });
    expect(ok.verified).toBe(true);
    expect(ok.text).toBe("2 checks passed");
  });

  it("fails verification on any failure", () => {
    const bad = summarize({
      ...base,
      steps: [
        { kind: "test", command: "npm test", status: "passed", summary: "16 passed" },
        { kind: "test", command: "npm test", status: "failed", summary: "2 failed", exitCode: 1 },
      ],
    });
    expect(bad.verified).toBe(false);
    expect(bad.failed).toBe(1);
  });

  it("no checks ran means not verified", () => {
    const none = summarize(base);
    expect(none.verified).toBe(false);
    expect(none.text).toBe("no checks ran");
  });
});
