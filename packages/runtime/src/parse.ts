import { toolCategory, type Activity } from "@grok-code/core";

/**
 * Parse one streaming-json NDJSON line into zero or more Activity events.
 * Pure function: fully unit-testable without a grok install.
 */
export function parseStreamLine(line: string): Activity[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return [{ type: "error", message: `无法解析的输出行: ${trimmed.slice(0, 120)}` }];
  }
  const type = raw["type"];
  switch (type) {
    case "text":
      return [{ type: "text", data: String(raw["data"] ?? "") }];
    case "thought":
      return [{ type: "thought", data: String(raw["data"] ?? "") }];
    case "plan": {
      const entries = (raw["entries"] as { title?: string; status?: string }[] | undefined) ?? [];
      return [
        {
          type: "plan",
          entries: entries.map((e) => ({ title: e.title ?? "", status: e.status ?? "" })),
        },
      ];
    }
    case "tool_call": {
      const toolName = String(raw["toolName"] ?? raw["name"] ?? "unknown");
      const input = (raw["rawInput"] as Record<string, unknown> | undefined) ?? {};
      const acts: Activity[] = [
        {
          type: "tool_start",
          toolCallId: String(raw["toolCallId"] ?? ""),
          toolName,
          category: toolCategory(toolName),
          title: String(raw["title"] ?? toolName),
          input,
        },
      ];
      const status = raw["status"];
      if (status === "completed" || status === "failed") {
        acts.push({
          type: "tool_update",
          toolCallId: String(raw["toolCallId"] ?? ""),
          status: status === "completed" ? "completed" : "failed",
          output: (raw["rawOutput"] as Record<string, unknown> | undefined) ?? {},
        });
      }
      return acts;
    }
    case "tool_call_update": {
      const status = raw["status"] === "failed" ? "failed" : raw["status"] === "in_progress" ? "in_progress" : "completed";
      return [
        {
          type: "tool_update",
          toolCallId: String(raw["toolCallId"] ?? ""),
          status,
          output: (raw["rawOutput"] as Record<string, unknown> | undefined) ?? {},
        },
      ];
    }
    case "usage":
      return [
        {
          type: "usage",
          usage: (raw["usage"] as Record<string, unknown> | undefined) ?? {},
          stopReason: raw["stopReason"] === undefined ? undefined : String(raw["stopReason"]),
        },
      ];
    case "end":
      return [
        {
          type: "end",
          stopReason: String(raw["stopReason"] ?? "end_turn"),
          sessionId: raw["sessionId"] === undefined ? undefined : String(raw["sessionId"]),
          usage: (raw["usage"] as Record<string, unknown> | undefined) ?? {},
          numTurns: typeof raw["num_turns"] === "number" ? raw["num_turns"] : undefined,
        },
      ];
    case "error":
      return [{ type: "error", message: String(raw["message"] ?? "unknown error") }];
    default:
      // Forward-compatible: unknown event types are ignored, not fatal.
      return [];
  }
}

export interface HeadlessSummary {
  text: string;
  sessionId?: string;
  stopReason: string;
  numTurns?: number;
  usage?: Record<string, unknown>;
  errors: string[];
  toolCalls: { id: string; name: string; status: string }[];
  timedOut: boolean;
}

export function reduceActivities(activities: Activity[], timedOut = false): HeadlessSummary {
  let text = "";
  let sessionId: string | undefined;
  let stopReason = "unknown";
  let numTurns: number | undefined;
  let usage: Record<string, unknown> | undefined;
  const errors: string[] = [];
  const toolCalls: { id: string; name: string; status: string }[] = [];
  for (const act of activities) {
    switch (act.type) {
      case "text":
        text += act.data;
        break;
      case "tool_start": {
        const existing = toolCalls.find((t) => t.id === act.toolCallId);
        if (existing) existing.name = act.toolName;
        else toolCalls.push({ id: act.toolCallId, name: act.toolName, status: "running" });
        break;
      }
      case "tool_update": {
        const existing = toolCalls.find((t) => t.id === act.toolCallId);
        if (existing) existing.status = act.status;
        else toolCalls.push({ id: act.toolCallId, name: "?", status: act.status });
        break;
      }
      case "usage":
        usage = act.usage;
        if (act.stopReason) stopReason = act.stopReason;
        break;
      case "end":
        stopReason = act.stopReason;
        sessionId = act.sessionId;
        numTurns = act.numTurns;
        usage = act.usage ?? usage;
        break;
      case "error":
        errors.push(act.message);
        break;
      default:
        break;
    }
  }
  return { text, sessionId, stopReason, numTurns, usage, errors, toolCalls, timedOut };
}
