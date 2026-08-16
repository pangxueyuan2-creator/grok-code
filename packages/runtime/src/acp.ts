import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import type { Activity } from "@grok-code/core";
import { buildGrokEnv } from "./proxy.js";
import { findGrokBinary } from "./locate.js";
import { parseStreamLine } from "./parse.js";
import { GrokRunError } from "./errors.js";

export interface PermissionRequest {
  requestId: string | number;
  sessionId: string;
  /** Friendly tool title, e.g. "Bash". */
  title?: string;
  kind?: string;
  /** The command or path under consideration. */
  subject?: string;
  options?: unknown;
}

export type PermissionDecision = "approve" | "deny";

export interface AcpEvents {
  update: (sessionId: string, update: Record<string, unknown>) => void;
  activity: (activity: Activity) => void;
  permissionRequest: (req: PermissionRequest) => void;
  notification: (method: string, params: unknown) => void;
  close: (code: number | null, signal: string | null) => void;
}

export interface AcpClientOptions {
  cwd?: string;
  binary?: string;
  model?: string;
  /** Always-approve at the grok level (FULL mode). */
  alwaysApprove?: boolean;
  agentProfile?: string;
  /** Decide permission requests. Default: deny (safest). */
  onPermission?: (req: PermissionRequest) => Promise<PermissionDecision> | PermissionDecision;
  env?: NodeJS.ProcessEnv;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Minimal but real ACP (Agent Client Protocol) client over stdio JSON-RPC.
 * Used for long-lived interactive sessions; headless mode is used for tasks.
 */
export class AcpClient extends EventEmitter {
  private child!: ChildProcess;
  private rl!: Interface;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private buffer = "";
  private closed = false;
  private closeInfo: { code: number | null; signal: string | null } | null = null;
  sessionId?: string;

  static async connect(options: AcpClientOptions = {}): Promise<AcpClient> {
    const client = new AcpClient();
    await client.open(options);
    return client;
  }

  private async open(options: AcpClientOptions): Promise<void> {
    const binary = options.binary ?? findGrokBinary();
    const args = ["agent"];
    if (options.alwaysApprove) args.push("--always-approve");
    if (options.model) args.push("--model", options.model);
    if (options.agentProfile) args.push("--agent-profile", options.agentProfile);
    args.push("stdio");

    const child = spawn(binary, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? buildGrokEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.rl = createInterface({ input: child.stdout ?? undefined });

    child.on("error", (err) => {
      this.emit("close", null, err.message);
      this.failAll(new GrokRunError(`启动 grok agent 失败: ${err.message}`));
    });
    child.on("close", (code, signal) => {
      this.closed = true;
      this.closeInfo = { code, signal };
      this.failAll(new GrokRunError(`grok agent 已退出 (${code ?? signal})`, { code, signal }));
      this.emit("close", code, signal);
    });

    let lineBuffer = "";
    this.rl.on("line", (line) => {
      // Handle split JSON (defensive; grok emits one per line).
      try {
        this.handleMessage(JSON.parse(line));
      } catch {
        lineBuffer += line;
        try {
          const msg = JSON.parse(lineBuffer);
          lineBuffer = "";
          this.handleMessage(msg);
        } catch {
          /* wait for more */
        }
      }
    });

    await this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const id = msg["id"];
    if (typeof id === "number" && this.pending.has(id)) {
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (msg["error"] !== undefined) {
        pending?.reject(new GrokRunError(JSON.stringify(msg["error"])));
      } else {
        pending?.resolve(msg["result"] ?? {});
      }
      return;
    }
    const method = String(msg["method"] ?? "");
    const params = (msg["params"] ?? {}) as Record<string, unknown>;

    if (method === "session/update") {
      const update = (params["update"] ?? {}) as Record<string, unknown>;
      const sessionId = String(params["sessionId"] ?? this.sessionId ?? "");
      this.emit("update", sessionId, update);
      // Also reduce ACP updates to the same Activity model the UI renders.
      const reduced = this.reduceUpdate(update);
      for (const act of reduced) this.emit("activity", act);
      return;
    }
    if (method === "session/request_permission") {
      const req: PermissionRequest = {
        requestId: typeof id === "number" ? id : String(id ?? this.nextId++),
        sessionId: String(params["sessionId"] ?? ""),
        title: params["title"] === undefined ? undefined : String(params["title"]),
        kind: params["kind"] === undefined ? undefined : String(params["kind"]),
        subject: params["subject"] === undefined ? undefined : String(params["subject"]),
        options: params["options"],
      };
      this.emit("permissionRequest", req);
      void this.answerPermission(req).catch(() => {});
      return;
    }
    this.emit("notification", method, params);
  }

  private async answerPermission(req: PermissionRequest): Promise<void> {
    const decision =
      this.permissionHandler !== undefined
        ? await this.permissionHandler(req)
        : "deny";
    if (this.closed) return;
    const outcome =
      decision === "approve" ? { outcome: "approved" } : { outcome: "denied" };
    this.child.stdin?.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: req.requestId,
        result: { outcome },
      }) + "\n",
    );
  }

  private permissionHandler?: (req: PermissionRequest) => Promise<PermissionDecision> | PermissionDecision;
  onPermission(handler: (req: PermissionRequest) => Promise<PermissionDecision> | PermissionDecision): void {
    this.permissionHandler = handler;
  }

  private reduceUpdate(update: Record<string, unknown>): Activity[] {
    const kind = String(update["sessionUpdate"] ?? "");
    switch (kind) {
      case "agent_message_chunk": {
        const content = (update["content"] ?? {}) as Record<string, unknown>;
        return [{ type: "text", data: String(content["text"] ?? "") }];
      }
      case "agent_thought_chunk": {
        const content = (update["content"] ?? {}) as Record<string, unknown>;
        return [{ type: "thought", data: String(content["text"] ?? "") }];
      }
      case "tool_call": {
        const content = ((update["content"] ?? []) as Record<string, unknown>[])[0] ?? {};
        return parseStreamLine(
          JSON.stringify({
            type: "tool_call",
            toolCallId: content["id"] ?? "",
            title: update["title"] ?? "",
            toolName: content["name"] ?? "",
            status: "in_progress",
            rawInput: content["input"] ?? {},
          }),
        );
      }
      case "tool_call_update": {
        const content = ((update["content"] ?? []) as Record<string, unknown>[])[0] ?? {};
        return parseStreamLine(
          JSON.stringify({
            type: "tool_call_update",
            toolCallId: content["id"] ?? "",
            status: update["status"] ?? "completed",
            rawOutput: content,
          }),
        );
      }
      case "plan":
        return parseStreamLine(JSON.stringify({ type: "plan", entries: update["entries"] ?? [] }));
      default:
        return [];
    }
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new GrokRunError("grok agent 已关闭"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin?.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
      );
    });
  }

  async newSession(
    params: { cwd?: string; mcpServers?: unknown; _meta?: Record<string, unknown> } = {},
  ): Promise<string> {
    const result = (await this.request("session/new", {
      cwd: params.cwd ?? process.cwd(),
      mcpServers: params.mcpServers ?? [],
      _meta: params._meta ?? {},
    })) as { sessionId?: string };
    if (!result.sessionId) throw new GrokRunError("grok 没有返回 session id");
    this.sessionId = result.sessionId;
    return result.sessionId;
  }

  /** Send a prompt; resolves when the turn completes. */
  prompt(
    sessionId: string,
    text: string,
    _meta?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
      _meta: _meta ?? {},
    });
  }

  cancel(sessionId: string): Promise<unknown> {
    return this.request("session/cancel", { sessionId });
  }

  close(): void {
    if (this.closed) return;
    this.child.kill();
  }

  get exitInfo(): { code: number | null; signal: string | null } | null {
    return this.closeInfo;
  }

  private failAll(err: Error): void {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}
