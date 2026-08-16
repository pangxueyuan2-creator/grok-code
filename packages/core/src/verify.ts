/**
 * Verification domain model: AI saying "done" is not enough. Grok Code runs the
 * project's real checks and separates IMPLEMENTED from VERIFIED.
 */

export type VerificationKind = "typecheck" | "lint" | "test" | "build" | "smoke";

export type VerificationStatus = "passed" | "failed" | "skipped" | "unavailable";

export interface VerificationStep {
  kind: VerificationKind;
  /** Command that produced this result, e.g. "npm test". */
  command: string;
  status: VerificationStatus;
  /** Short human summary, e.g. "18 passed" or "2 failed". */
  summary: string;
  durationMs?: number;
  /** Pro-Mode detail: exit code, stdout/stderr tails. */
  exitCode?: number;
  stdoutTail?: string;
  stderrTail?: string;
}

export interface VerificationResult {
  steps: VerificationStep[];
  startedAt: string;
  finishedAt: string;
}

export function summarize(result: VerificationResult): {
  verified: boolean;
  passed: number;
  failed: number;
  skipped: number;
  text: string;
} {
  const passed = result.steps.filter((s) => s.status === "passed").length;
  const failed = result.steps.filter((s) => s.status === "failed").length;
  const skipped = result.steps.filter((s) => s.status === "skipped").length;
  const text =
    failed > 0
      ? `${failed} check${failed === 1 ? "" : "s"} failed`
      : passed > 0
        ? `${passed} check${passed === 1 ? "" : "s"} passed`
        : "no checks ran";
  return { verified: failed === 0 && passed > 0, passed, failed, skipped, text };
}
