import type { RiskLevel } from "@grok-code/core";

export type PermissionModeName = "SAFE" | "AUTO" | "FULL";

export interface HeadlessOptions {
  prompt: string;
  cwd: string;
  mode?: PermissionModeName;
  model?: string;
  sessionId?: string;
  resumeId?: string;
  continueLatest?: boolean;
  maxTurns?: number;
  tools?: string[];
  disallowedTools?: string[];
  /** Extra deny rules always appended (defense in depth). */
  extraDeny?: string[];
  outputFormat?: "plain" | "json" | "streaming-json" | "streaming-messages-json";
  noAutoUpdate?: boolean;
  verbatim?: boolean;
}

/**
 * Hard deny rules applied in EVERY mode, including FULL. Simple never means
 * unsafe: credential exfiltration and system-destructive commands stay denied
 * no matter what the user selected.
 */
export const HARD_DENY_RULES = [
  "Bash(sudo*)",
  "Bash(shutdown*)",
  "Bash(reboot*)",
  "Bash(format *)",
  "Bash(del /s /q C:*)",
  "Bash(rd /s C:*)",
  "Bash(git push *--force*)",
  "Bash(git reset --hard*)",
  "Bash(rm -rf /*)",
  "Bash(cat */.env*)",
  "Bash(type */.env*)",
  "Bash(curl *api.openai.com*)",
  "Bash(wget *api.openai.com*)",
];

/** Map our three human modes to grok's permission surface. */
export function permissionFlags(
  mode: PermissionModeName,
): { permissionMode?: string; extraAllow?: string[]; extraDeny?: string[] } {
  switch (mode) {
    case "SAFE":
      // grok "default" asks before anything above low-risk; we additionally
      // deny the write-heavy prefixes so headless runs stop instead of hanging.
      return {
        permissionMode: "default",
        extraDeny: ["Bash(git push*)", "Bash(npm publish*)", "Bash(pip install*)"],
      };
    case "AUTO":
      return { permissionMode: "auto" };
    case "FULL":
      // bypassPermissions is still subject to --deny rules and hooks.
      return { permissionMode: "bypassPermissions" };
  }
}

export function buildHeadlessArgs(options: HeadlessOptions): string[] {
  const args: string[] = ["-p", options.prompt];
  args.push("--output-format", options.outputFormat ?? "streaming-json");
  if (options.model) args.push("-m", options.model);
  if (options.maxTurns !== undefined) args.push("--max-turns", String(options.maxTurns));
  if (options.sessionId) args.push("-s", options.sessionId);
  if (options.resumeId) args.push("-r", options.resumeId);
  if (options.continueLatest) args.push("-c");
  if (options.tools?.length) args.push("--tools", options.tools.join(","));
  if (options.disallowedTools?.length) args.push("--disallowed-tools", options.disallowedTools.join(","));
  if (options.verbatim) args.push("--verbatim");
  args.push("--no-auto-update");

  const { permissionMode, extraAllow, extraDeny } = permissionFlags(options.mode ?? "AUTO");
  if (permissionMode) args.push("--permission-mode", permissionMode);
  for (const rule of extraAllow ?? []) args.push("--allow", rule);
  const denies = [...(extraDeny ?? []), ...HARD_DENY_RULES, ...(options.extraDeny ?? [])];
  for (const rule of new Set(denies)) args.push("--deny", rule);

  args.push("--cwd", options.cwd);
  return args;
}

/** Human explanation for the permission badge in the UI. */
export function describePermissionMode(mode: PermissionModeName): string {
  switch (mode) {
    case "SAFE":
      return "重要修改前询问";
    case "AUTO":
      return "低风险自动执行，高风险询问（推荐）";
    case "FULL":
      return "尽可能自主运行，系统级操作仍会被拦截";
  }
}

export function describeRisk(level: RiskLevel): string {
  switch (level) {
    case "LOW":
      return "低风险";
    case "MEDIUM":
      return "中风险";
    case "HIGH":
      return "高风险";
    case "CRITICAL":
      return "危险";
  }
}
