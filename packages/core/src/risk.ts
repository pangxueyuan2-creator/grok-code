/**
 * Risk classification shared by the permission system and the UI. The mapping
 * from grok tool ids / commands to risk levels is intentionally conservative:
 * when in doubt, escalate.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** A grok tool or permission subject with its assessed risk. */
export interface RiskAssessment {
  level: RiskLevel;
  /** Why it is classified this way, for the permission prompt. */
  reason: string;
  /** What would NOT be affected (shown to reassure). */
  notAffecting?: string;
}

const CRITICAL_COMMANDS = [
  /^rms+-rf?s+//,
  /^sudo/,
  /^shutdown/,
  /^reboot/,
  /^formats+[a-z]:/i,
  /^dels+/ss+/qs+[a-z]:\\/i,
  /^chmods+-R?s+777s+//,
  /gits+pushs+.*(--force|:s*$)/,
  /^gits+resets+--hard/,
  /^gits+cleans+-f/,
];

const HIGH_COMMANDS = [
  /rm/,
  /del/i,
  /^rd/i,
  /^rmdir/i,
  /gits+(reset|clean|rebase)/,
  /scp/,
  /ssh/,
  /openssl/,
  /--force/,
  /kill/,
  /wget/,
  /curl/,
];

const MEDIUM_COMMANDS = [
  /(npm|pnpm|yarn|pip|pip3|cargo|gem|go)s+(install|add|update|upgrade)/,
  /gits+(checkout|switch|stash|merge|push)/,
  /mkdir/,
  /move|mv/,
];

/** Classify a shell command. Returns CRITICAL if clearly dangerous. */
export function classifyCommand(command: string): RiskAssessment {
  if (CRITICAL_COMMANDS.some((re) => re.test(command))) {
    return {
      level: "CRITICAL",
      reason: "可能影响系统安全或破坏 Git 历史",
      notAffecting: "不会在 SAFE / AUTO 模式下自动执行",
    };
  }
  if (HIGH_COMMANDS.some((re) => re.test(command))) {
    return {
      level: "HIGH",
      reason: "可能删除文件或改写 Git 状态",
      notAffecting: "源代码之外的内容不受影响时按规则提示",
    };
  }
  if (MEDIUM_COMMANDS.some((re) => re.test(command))) {
    return { level: "MEDIUM", reason: "安装依赖或改变工作区状态" };
  }
  return { level: "LOW", reason: "只读或低影响命令" };
}

const WRITE_TOOL_IDS = new Set([
  "write_file",
  "search_replace",
  "create_file",
  "delete_files",
  "run_terminal_cmd",
]);

/** Classify a grok tool id (toolName from streaming-json / ACP). */
export function classifyTool(toolName: string, rawInput?: Record<string, unknown>): RiskAssessment {
  if (toolName === "run_terminal_cmd") {
    const cmd = String(
      (rawInput as Record<string, unknown> | undefined)?.["command"] ??
        (rawInput as Record<string, unknown> | undefined)?.["cmd"] ??
        "",
    );
    return classifyCommand(cmd);
  }
  if (toolName === "delete_files") {
    return { level: "HIGH", reason: "删除项目文件", notAffecting: "不修改 Git 历史" };
  }
  if (WRITE_TOOL_IDS.has(toolName)) {
    return { level: "MEDIUM", reason: "修改项目源代码" };
  }
  return { level: "LOW", reason: "只读操作" };
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};
