# ForgePilot

**A safer coding-agent control plane with real Grok Build dispatch, durable resume, and multi-provider protocol foundations.**

> The project currently lives in the `grok-code` repository while the public name settles. Package scopes still use `@grok-code/*` so existing imports do not break.

ForgePilot is an independent control plane for long-running, user-controlled coding work. It is not a telemetry-off fork of Grok Build.

## What works today

- **Real autonomous coding dispatch through Grok Build (xAI path)**
- Provider profiles and protocol adapters for xAI, OpenAI, Anthropic, and OpenAI-compatible endpoints
- Windows as a first-class platform
- Durable append-only task journals written to `~/.forgepilot/journals` (or `$FORGEPILOT_HOME/journals`)
- Fixed Grok session ids so interrupted tasks can be resumed with `forgepilot resume <taskId>`
- Fail-closed policy for destructive shell and unknown tools
- Independent verification using checks already declared by the target Node project
- A task is reported `DONE` only when execution finishes cleanly **and** verification passes
- Credentials referenced by environment-variable **name** only

## Important scope boundary

ForgePilot does **not** currently claim that every provider can autonomously edit code.

| Provider path | Protocol support | Autonomous coding-tool dispatch |
|---|---:|---:|
| Grok Build / xAI | ✅ | ✅ implemented |
| OpenAI Responses | ✅ | ⏳ tool loop pending |
| Anthropic Messages | ✅ | ⏳ tool loop pending |
| OpenAI-compatible / local | ✅ | ⏳ tool loop pending |

The direct-provider adapters are real transport implementations, but their provider-native tool-execution loops are future work. ForgePilot fails explicitly rather than silently pretending those paths edited a repository.

## Packages

| Package | Role |
|---|---|
| `@grok-code/core` | Task state, risk, policy, journal model, verification gate, providers |
| `@grok-code/runtime` | Grok CLI/ACP, protocol adapters, durable journal store, verification runner, Windows/worktree support |
| `@grok-code/cli` | `forgepilot` command |

## Quick start

```bash
pnpm install
pnpm test

# Inspect routing only. No model call, no file change.
pnpm exec forgepilot plan "Add a /health endpoint" --provider xai --mode AUTO

# Real coding-agent execution through Grok Build.
pnpm exec forgepilot run "Add a /health endpoint" --provider xai --mode AUTO
```

`run` and `dispatch` are aliases. They execute; `plan` is the explicit dry-run command.

If a task is interrupted or fails the completion gate, ForgePilot prints a task id. Resume it with:

```bash
pnpm exec forgepilot resume <taskId>
```

The task journal is persisted outside the workspace by default, so crash recovery does not depend on an in-memory object surviving.

## Verification semantics

The model saying “done” is not evidence.

After Grok Build finishes, ForgePilot discovers existing Node project scripts in this order:

1. `typecheck`
2. `lint`
3. `test`
4. `build`

It runs only scripts the project already declares. It does not invent arbitrary verification shell commands.

- If declared checks run and all pass: `DONE`
- If checks fail: `NEEDS_ATTENTION`, task stays resumable
- If no declared checks can be found: `NEEDS_ATTENTION`, never fake a verified completion

## Permission modes

- `SAFE`: asks before meaningful writes; hard-deny rules still apply
- `AUTO`: low-risk work can proceed; high-risk actions require approval
- `FULL`: more autonomy, but critical destructive commands remain denied

Unknown tools fail closed. Silent provider switching is forbidden.

## Security invariants

1. Critical destructive commands stay denied even in `FULL`.
2. Provider metadata stores environment-variable names, never raw API keys.
3. Journal payloads strip API keys, bearer tokens, and hidden reasoning fields before disk persistence.
4. Remote provider URLs require HTTPS; plaintext HTTP is allowed only for loopback runtimes.
5. A task cannot be reported `DONE` without independent verification evidence.

## Current limitations

- Direct OpenAI / Anthropic / local provider adapters do not yet run the autonomous coding tool loop.
- Verification auto-discovery currently targets declared Node package scripts.
- The operator GUI/workbench is not shipped in this repository yet.
- Live resume depends on Grok Build's public session-resume surface.

## Docs

- [Provider protocols](docs/PROVIDERS.md)
- [Windows](docs/WINDOWS.md)
- [Grok Build compatibility](docs/COMPATIBILITY.md)
- [Upstream license review](docs/UPSTREAM_LICENSE_REVIEW.md)

## Development

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs the quality gate on Ubuntu, Windows, and macOS.

## License

Apache-2.0. Independent project, not affiliated with xAI, SpaceXAI, OpenAI, or Anthropic. See `NOTICE`.
