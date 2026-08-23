# ForgePilot

**A safer, multi-provider coding-agent control plane built around Grok Build compatibility.**

> This project currently lives in the `grok-code` repository while the public name settles. Package scopes still use `@grok-code/*` so existing imports do not break.

ForgePilot is not a telemetry-off fork of Grok Build. It is an independent control plane for long-running, user-controlled coding work:

- Multi-provider routing (xAI, OpenAI, Anthropic, OpenAI-compatible loopback)
- Windows as a first-class platform
- Append-only, schema-versioned task journals with crash resume
- Fail-closed policy for destructive shell and unknown tools
- Independent verification before a task can become `DONE`
- Isolated Git worktrees for parallel agents
- MCP/Skill install provenance (pinned digest, HTTPS, fail-closed if unpinned)
- Credentials referenced by environment-variable **name** only

## Packages

| Package | Role |
|---|---|
| `@grok-code/core` | Task state machine, risk, policy, journal, verification gate, providers |
| `@grok-code/runtime` | Grok CLI/ACP, protocol adapters, Windows quoting, worktrees |
| `@grok-code/cli` | `forgepilot` command |

## Quick start

```bash
pnpm install
pnpm test
pnpm exec forgepilot providers
pnpm exec forgepilot run "Add a /health endpoint" --provider xai --mode AUTO
```

Set `XAI_API_KEY` (or the env name on the chosen profile). Never put the key in repo config.

## Control plane rules

1. A task may not enter `DONE` without passing independent verification.
2. `CRITICAL` commands are denied in every permission mode, including `FULL`.
3. Unknown tools are denied (fail closed).
4. Fallback to another provider is opt-in and must be explicit. Silent switching is forbidden.
5. Journals strip API keys, bearer tokens, and hidden chain-of-thought.

## Docs

- [Provider protocols](docs/PROVIDERS.md)
- [Windows](docs/WINDOWS.md)
- [Grok Build compatibility](docs/COMPATIBILITY.md)
- [Upstream license review](docs/UPSTREAM_LICENSE_REVIEW.md)

## License

Apache-2.0. Independent project — not affiliated with xAI, SpaceXAI, OpenAI, or Anthropic. See `NOTICE`.
