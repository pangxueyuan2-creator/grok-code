/**
 * Verification domain model: the model saying "done" is not enough.
 * Independent checks separate IMPLEMENTED from VERIFIED.
 */

export type VerificationKind = "typecheck" | "lint" | "test" | "build" | "smoke";

export type VerificationStatus = "passed" | "failed" | "skipped" | "unavailable";

export interface VerificationStep {
  kind: VerificationKind;
  command: string;
  status: VerificationStatus;
  summary: string;
  durationMs?: number;
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

/**
 * Independent completion gate. A task may not enter DONE unless verification
 * ran and passed. Missing evidence is a hard fail, not a skip.
 */
export function canMarkCompleted(result: VerificationResult | undefined): {
  ok: boolean;
  reason: string;
} {
  if (!result) {
    return { ok: false, reason: "No independent verification evidence recorded." };
  }
  const summary = summarize(result);
  if (!summary.verified) {
    return { ok: false, reason: `Verification gate refused completion: ${summary.text}.` };
  }
  return { ok: true, reason: summary.text };
}
