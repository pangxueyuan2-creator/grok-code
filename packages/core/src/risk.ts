/**
 * Risk classification shared by the permission system and the UI.
 * Conservative: when in doubt, escalate. Windows and POSIX both covered.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessment {
  level: RiskLevel;
  reason: string;
  notAffecting?: string;
}

const CRITICAL_COMMANDS = [
  /^rm\s+-rf?\s+\//,
  /^sudo\b/,
  /^shutdown\b/,
  /^reboot\b/,
  /^format\s+[a-z]:/i,
  /^del\s+\/s\s+\/q\s+[a-z]:\\/i,
  /^chmod\s+-R?\s+777\s+\//,
  /git\s+push\s+.*(--force|:\s*$)/,
  /^git\s+reset\s+--hard/,
  /^git\s+clean\s+-f/,
  /Stop-Computer\b/i,
  /Restart-Computer\b/i,
  /Format-Volume\b/i,
  /Remove-Item\s+.*-Recurse.*(\/|[A-Za-z]:\\)/i,
  /rd\s+\/s\s+\/q\s+[a-z]:/i,
];

const HIGH_COMMANDS = [
  /\brm\b/,
  /\bdel\b/i,
  /^rd\b/i,
  /^rmdir\b/i,
  /\bgit\s+(reset|clean|rebase)\b/,
  /\bscp\b/,
  /\bssh\b/,
  /\bopenssl\b/,
  /--force/,
  /\bkill\b/,
  /\bwget\b/,
  /\bcurl\b/,
  /Remove-Item\b/i,
  /Invoke-WebRequest\b/i,
  /Invoke-Expression\b/i,
  /\biex\b/i,
];

const MEDIUM_COMMANDS = [
  /\b(npm|pnpm|yarn|pip|pip3|cargo|gem|go)\s+(install|add|update|upgrade)\b/,
  /\bgit\s+(checkout|switch|stash|merge|push)\b/,
  /\bmkdir\b/,
  /\bmove\b|\bmv\b/,
  /New-Item\b/i,
  /Copy-Item\b/i,
  /Move-Item\b/i,
];

export function classifyCommand(command: string): RiskAssessment {
  if (CRITICAL_COMMANDS.some((re) => re.test(command))) {
    return {
      level: "CRITICAL",
      reason: "May affect system safety or rewrite Git history",
      notAffecting: "Never auto-executed in SAFE or AUTO mode",
    };
  }
  if (HIGH_COMMANDS.some((re) => re.test(command))) {
    return {
      level: "HIGH",
      reason: "May delete files or rewrite Git state",
      notAffecting: "Does not change files outside the assessed path",
    };
  }
  if (MEDIUM_COMMANDS.some((re) => re.test(command))) {
    return { level: "MEDIUM", reason: "Installs dependencies or changes workspace state" };
  }
  return { level: "LOW", reason: "Read-only or low-impact command" };
}

const WRITE_TOOL_IDS = new Set([
  "write_file",
  "search_replace",
  "create_file",
  "delete_files",
  "run_terminal_cmd",
]);

export function classifyTool(toolName: string, rawInput?: Record<string, unknown>): RiskAssessment {
  if (toolName === "run_terminal_cmd") {
    const cmd = String(rawInput?.command ?? rawInput?.cmd ?? "");
    return classifyCommand(cmd);
  }
  if (toolName === "delete_files") {
    return { level: "HIGH", reason: "Deletes project files", notAffecting: "Does not rewrite Git history" };
  }
  if (WRITE_TOOL_IDS.has(toolName)) {
    return { level: "MEDIUM", reason: "Modifies project source" };
  }
  return { level: "LOW", reason: "Read-only operation" };
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};
