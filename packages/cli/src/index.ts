#!/usr/bin/env node
import { createBuiltinRegistry, describePermissionMode, type PermissionModeName } from "@grok-code/core";
import { adapterFor, detectShell, findGrokBinary, planWorktree } from "@grok-code/runtime";
import {
  dispatchTask,
  resumeTask,
  type DispatchDependencies,
  type DispatchOptions,
} from "./dispatch.js";

function help(): string {
  return `ForgePilot — safer coding-agent control plane

Usage:
  forgepilot providers              List built-in provider profiles
  forgepilot plan <prompt>          Dry-run routing/worktree plan; changes nothing
  forgepilot run <prompt>           Execute a real Grok Build coding task
  forgepilot dispatch <prompt>      Alias for run
  forgepilot resume <taskId>        Resume an interrupted persisted task
  forgepilot compat                 Print the compatibility matrix

Flags:
  --provider <id>     xai | openai | anthropic | local   (default: xai)
  --model <name>      override the profile model
  --mode SAFE|AUTO|FULL
  --cwd <path>        target workspace (default: current directory)
  --max-turns <n>     Grok Build turn limit for run/dispatch
  --timeout-ms <n>    execution timeout for run/dispatch
  --allow-fallback    planning only; live dispatch never silently switches providers
  --local-only        planning only; live local tool dispatch is not implemented yet

Important runtime truth:
- run/dispatch currently performs autonomous coding-tool execution through Grok Build (xAI path).
- OpenAI/Anthropic/OpenAI-compatible adapters are protocol foundations today; their coding-tool loop is not yet implemented.
- task journals are persisted under ~/.forgepilot/journals (or $FORGEPILOT_HOME/journals).
- a task is reported DONE only after independent declared project checks pass.
`;
}

function arg(flag: string, argv: string[]): string | undefined {
  const i = argv.indexOf(flag);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function has(flag: string, argv: string[]): boolean {
  return argv.includes(flag);
}

const VALUE_FLAGS = new Set([
  "--provider",
  "--model",
  "--mode",
  "--cwd",
  "--max-turns",
  "--timeout-ms",
]);

function promptFrom(argv: string[]): string {
  const parts: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;
    if (VALUE_FLAGS.has(token)) {
      i += 1;
      continue;
    }
    if (token.startsWith("--")) continue;
    parts.push(token);
  }
  return parts.join(" ").trim();
}

function permissionMode(argv: string[]): PermissionModeName {
  const mode = (arg("--mode", argv) ?? "AUTO").toUpperCase();
  if (mode !== "SAFE" && mode !== "AUTO" && mode !== "FULL") {
    throw new Error(`Invalid permission mode: ${mode}`);
  }
  return mode;
}

function positiveInt(flag: string, argv: string[]): number | undefined {
  const raw = arg(flag, argv);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} must be a positive integer.`);
  return value;
}

export interface CliDependencies extends DispatchDependencies {
  dispatchImpl?: (options: DispatchOptions, deps?: DispatchDependencies) => Promise<string>;
  resumeImpl?: (taskId: string, deps?: DispatchDependencies) => Promise<string>;
}

function plan(argv: string[]): string {
  const prompt = promptFrom(argv);
  if (!prompt) return "forgepilot plan <prompt>";
  const registry = createBuiltinRegistry();
  const providerId = arg("--provider", argv) ?? "xai";
  const model = arg("--model", argv);
  const mode = permissionMode(argv);
  const profile = registry.get(providerId);
  const adapter = adapterFor(profile.protocol);
  const cwd = arg("--cwd", argv) ?? process.cwd();
  const worktree = planWorktree("cli", cwd);
  let grok = "not installed";
  try {
    grok = findGrokBinary();
  } catch {
    grok = "not found (optional for planning)";
  }
  return [
    "DRY RUN — no model call or tool execution occurred",
    `prompt:     ${prompt}`,
    `provider:   ${profile.id} (${profile.kind})`,
    `protocol:   ${adapter.protocol}`,
    `model:      ${model ?? profile.model}`,
    `mode:       ${mode} — ${describePermissionMode(mode)}`,
    `fallback:   ${has("--allow-fallback", argv) ? "explicit only" : "forbidden"}`,
    `remote:     ${has("--local-only", argv) ? "loopback only" : "allowed"}`,
    `apiKeyEnv:  ${profile.apiKeyEnv}`,
    `shell:      ${detectShell()}`,
    `worktree:   ${worktree.path}`,
    `grok:       ${grok}`,
  ].join("\n");
}

async function dispatch(argv: string[], deps: CliDependencies): Promise<string> {
  const prompt = promptFrom(argv);
  if (!prompt) return "forgepilot run <prompt>";
  if (has("--allow-fallback", argv)) {
    throw new Error("Live dispatch does not silently or automatically fall back to another provider.");
  }
  if (has("--local-only", argv)) {
    throw new Error("Live local-provider coding-tool dispatch is not implemented yet; use forgepilot plan for local routing inspection.");
  }

  const options: DispatchOptions = {
    prompt,
    cwd: arg("--cwd", argv) ?? process.cwd(),
    providerId: arg("--provider", argv) ?? "xai",
    model: arg("--model", argv),
    mode: permissionMode(argv),
    maxTurns: positiveInt("--max-turns", argv),
    timeoutMs: positiveInt("--timeout-ms", argv),
  };
  return (deps.dispatchImpl ?? dispatchTask)(options, deps);
}

export async function main(
  argv: string[] = process.argv.slice(2),
  deps: CliDependencies = {},
): Promise<string> {
  const cmd = argv[0] ?? "help";
  const registry = createBuiltinRegistry();

  if (cmd === "help" || cmd === "--help" || cmd === "-h") return help();

  if (cmd === "providers") {
    return registry
      .list()
      .map(
        (p) =>
          `${p.id.padEnd(12)} ${p.protocol.padEnd(22)} ${p.model.padEnd(18)} ${p.apiKeyEnv}  ${p.baseUrl}`,
      )
      .join("\n");
  }

  if (cmd === "compat") {
    return [
      "ForgePilot compatibility (public surfaces only; not an xAI product)",
      "",
      "Grok Build CLI / ACP     real autonomous coding dispatch",
      "OpenAI-compatible HTTP   inference adapter; tool loop pending",
      "OpenAI Responses API     inference adapter; tool loop pending",
      "Anthropic Messages API   inference adapter; tool loop pending",
      "Windows                  cmd/PowerShell quoting, proxy inherit, CRLF",
      "Durable resume           append-only JSONL journal + fixed Grok session id",
      "Verification gate        declared checks required before DONE",
      "Silent provider switch   never",
    ].join("\n");
  }

  if (cmd === "plan") return plan(argv);

  if (cmd === "run" || cmd === "dispatch") return dispatch(argv, deps);

  if (cmd === "resume") {
    const id = argv[1];
    if (!id) return "forgepilot resume <taskId>";
    return (deps.resumeImpl ?? resumeTask)(id, deps);
  }

  return help();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.js")) {
  main()
    .then((output) => process.stdout.write(`${output}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`ForgePilot error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
