import { classifyTool, RISK_ORDER, type RiskAssessment, type RiskLevel } from "./risk.js";

export type PermissionModeName = "SAFE" | "AUTO" | "FULL";

export type PolicyVerdict = "allow" | "ask" | "deny";

export interface PolicyInput {
  mode: PermissionModeName;
  toolName: string;
  command?: string;
  path?: string;
}

export interface PolicyDecision {
  verdict: PolicyVerdict;
  risk: RiskAssessment;
  reason: string;
  failClosed: boolean;
}

const UNKNOWN_TOOL_FAIL_CLOSED: RiskAssessment = {
  level: "HIGH",
  reason: "Unknown tool — fail closed",
};

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const rawInput = input.command
    ? { command: input.command, path: input.path }
    : input.path
      ? { path: input.path }
      : undefined;
  const known =
    input.toolName === "run_terminal_cmd" ||
    input.toolName === "delete_files" ||
    input.toolName === "write_file" ||
    input.toolName === "search_replace" ||
    input.toolName === "create_file" ||
    input.toolName === "read_file" ||
    input.toolName === "grep" ||
    input.toolName === "list_dir" ||
    input.toolName === "glob";

  const risk = known ? classifyTool(input.toolName, rawInput) : UNKNOWN_TOOL_FAIL_CLOSED;
  return decide(input.mode, risk, known);
}

function decide(mode: PermissionModeName, risk: RiskAssessment, known: boolean): PolicyDecision {
  if (!known) {
    return {
      verdict: "deny",
      risk,
      reason: "Unknown tool denied (fail closed).",
      failClosed: true,
    };
  }
  if (risk.level === "CRITICAL") {
    return {
      verdict: "deny",
      risk,
      reason: "Critical operations are always denied, including FULL mode.",
      failClosed: true,
    };
  }

  switch (mode) {
    case "SAFE":
      if (RISK_ORDER[risk.level] >= RISK_ORDER.MEDIUM) {
        return { verdict: "ask", risk, reason: "SAFE mode asks before any write or install.", failClosed: false };
      }
      return { verdict: "allow", risk, reason: "Read-only in SAFE mode.", failClosed: false };
    case "AUTO":
      if (risk.level === "HIGH") {
        return { verdict: "ask", risk, reason: "AUTO mode asks before high-risk actions.", failClosed: false };
      }
      return { verdict: "allow", risk, reason: "Within AUTO risk budget.", failClosed: false };
    case "FULL":
      return { verdict: "allow", risk, reason: "FULL mode allows non-critical actions.", failClosed: false };
  }
}

export function describePermissionMode(mode: PermissionModeName): string {
  switch (mode) {
    case "SAFE":
      return "Ask before anything that writes";
    case "AUTO":
      return "Low risk auto, high risk asks";
    case "FULL":
      return "Autonomous except critical denies";
  }
}

export function describeRisk(level: RiskLevel): string {
  switch (level) {
    case "LOW":
      return "Low";
    case "MEDIUM":
      return "Medium";
    case "HIGH":
      return "High";
    case "CRITICAL":
      return "Critical";
  }
}
