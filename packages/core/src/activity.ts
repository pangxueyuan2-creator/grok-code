/**
 * Normalized activity stream. Both transports (headless streaming-json and ACP
 * session/update) are reduced to these events so the UI renders ONE clean model.
 */

export type ActivityType =
  | "text"
  | "thought"
  | "tool_start"
  | "tool_update"
  | "tool_end"
  | "plan"
  | "usage"
  | "state"
  | "permission_required"
  | "error"
  | "end";

export interface ActivityText {
  type: "text";
  data: string;
}

export interface ActivityThought {
  type: "thought";
  data: string;
}

export interface ActivityToolStart {
  type: "tool_start";
  toolCallId: string;
  toolName: string;
  /** Friendly category: READ / SEARCH / EDIT / WRITE / COMMAND / TEST / ... */
  category: string;
  title: string;
  input: Record<string, unknown>;
}

export interface ActivityToolUpdate {
  type: "tool_update";
  toolCallId: string;
  status: "in_progress" | "completed" | "failed";
  output?: Record<string, unknown>;
  /** Short human-readable summary of the tool result. */
  summary?: string;
}

export interface ActivityEnd {
  type: "end";
  stopReason: string;
  sessionId?: string;
  usage?: Record<string, unknown>;
  numTurns?: number;
}

export type Activity =
  | ActivityText
  | ActivityThought
  | ActivityToolStart
  | ActivityToolUpdate
  | { type: "plan"; entries: { title: string; status: string }[] }
  | { type: "usage"; usage: Record<string, unknown>; stopReason?: string }
  | { type: "state"; state: string }
  | {
      type: "permission_required";
      toolCallId: string;
      toolName: string;
      command?: string;
      path?: string;
    }
  | { type: "error"; message: string }
  | ActivityEnd;

/** Map a grok tool id to the friendly structured-tool-card category. */
export function toolCategory(toolName: string): string {
  if (/read|grep|list_dir|glob|view/i.test(toolName)) return "READ";
  if (/search/i.test(toolName)) return "SEARCH";
  if (/edit|search_replace|multi_edit|patch/i.test(toolName)) return "EDIT";
  if (/write|create/i.test(toolName)) return "WRITE";
  if (/terminal|bash|cmd|shell/i.test(toolName)) return "COMMAND";
  if (/test/i.test(toolName)) return "TEST";
  if (/build|compile/i.test(toolName)) return "BUILD";
  if (/git|commit|branch|worktree/i.test(toolName)) return "GIT";
  if (/web/i.test(toolName)) return "WEB";
  if (/mcp/i.test(toolName)) return "MCP";
  if (/agent/i.test(toolName)) return "AGENT";
  return "TOOL";
}
