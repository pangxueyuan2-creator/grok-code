#!/usr/bin/env node
import { createBuiltinRegistry, describePermissionMode, type PermissionModeName } from "@grok-code/core";
import { adapterFor, detectShell, findGrokBinary, planWorktree } from "@grok-code/runtime";

function help(): string {
  return `ForgePilot — safer multi-provider coding-agent control plane

Usage:
  forgepilot providers              List built-in provider profiles
  forgepilot run <prompt>           Show the routing plan for a task
  forgepilot resume <taskId>        Print resume instructions
  forgepilot compat                 Print the Grok Build compatibility matrix

Flags:
  --provider <id>     xai | openai | anthropic | local   (default: xai)
  --model <name>      override the profile model
  --mode SAFE|AUTO|FULL
  --allow-fallback    opt in to explicit fallback only
  --local-only        forbid remote providers

Credentials are read from environment-variable names on the provider profile.
ForgePilot never stores raw API keys in task journals.
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

export function main(argv = process.argv.slice(2)): string {
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
      "Grok Build CLI / ACP     runtime headless + AcpClient",
      "OpenAI-compatible HTTP   xAI default, custom loopback allowed",
      "OpenAI Responses API     openai provider protocol",
      "Anthropic Messages API   anthropic provider protocol",
      "Windows                  cmd/PowerShell quoting, proxy inherit, CRLF",
      "Verification gate        required before DONE",
      "Silent provider switch   never",
    ].join("\n");
  }

  if (cmd === "resume") {
    const id = argv[1];
    if (!id) return "forgepilot resume <taskId>";
    return `Resume task ${id} from the append-only journal checkpoint. Hidden chain-of-thought is not stored.`;
  }

  if (cmd === "run") {
    const prompt = argv.filter((a) => !a.startsWith("--")).slice(1).join(" ").trim();
    if (!prompt) return "forgepilot run <prompt>";
    const providerId = arg("--provider", argv) ?? "xai";
    const model = arg("--model", argv);
    const mode = (arg("--mode", argv) ?? "AUTO") as PermissionModeName;
    const profile = registry.get(providerId);
    const adapter = adapterFor(profile.protocol);
    const worktree = planWorktree("cli", process.cwd());
    let grok = "not installed";
    try {
      grok = findGrokBinary();
    } catch {
      grok = "not found (optional)";
    }
    return [
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

  return help();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.js")) {
  process.stdout.write(`${main()}\n`);
}
