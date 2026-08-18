# ForgePilot

**A safer, multi-provider coding-agent workbench built around the Grok Build runtime ecosystem.**

> Repository migration note: this project currently lives in the `grok-code` repository while the codebase is being renamed. Package scopes may still use `@grok-code/*` until the migration is completed deliberately rather than breaking imports in one giant rename.

ForgePilot extends the ideas and public integration surfaces of [xai-org/grok-build](https://github.com/xai-org/grok-build) with a focus on areas that matter for long-running, user-controlled coding work:

- multi-provider model routing instead of one model/vendor being wired through the product
- Windows as a first-class platform, not a best-effort afterthought
- resumable tasks and auditable execution history
- explicit command/file risk policy before destructive operations
- independent verification before an agent can claim a task is complete
- isolated worktrees for parallel agents
- pre-install safety checks for MCP servers, Skills, and other discovered agent resources
- privacy-conscious defaults with credentials referenced through environment variables rather than stored in project config

## Current status

Early development. The existing workspace already contains:

- a core task/change/risk/verification domain model
- a runtime integration layer for Grok Build / ACP
- proxy and process-spawn helpers
- cross-platform CI targeting Linux, Windows, and macOS

The first ForgePilot-specific milestone adds a provider-neutral configuration layer for xAI, OpenAI, Anthropic, and custom OpenAI-compatible endpoints. Provider profiles store the **name** of the environment variable containing a credential, never the credential itself.

## Why not just fork and rebrand Grok Build?

A useful derivative needs a reason to exist. ForgePilot is not intended to be a logo swap or a telemetry toggle. The project keeps Grok Build compatibility where it is useful while building an independent control plane around portability, provider choice, resumability, verification, and security.

## Provider configuration model

The provider registry lives in `packages/core/src/provider.ts`.

Built-in provider kinds:

- `xai`
- `openai`
- `anthropic`
- `openai-compatible` for self-hosted or third-party compatible endpoints

Security defaults:

- remote provider endpoints must use HTTPS
- loopback HTTP is allowed for local runtimes such as Ollama-compatible gateways
- raw API keys are rejected from provider metadata; configuration points to environment-variable names
- duplicate provider IDs are rejected

## Roadmap

### Milestone 1: provider-neutral control plane

- [x] provider profiles and registry
- [x] safe endpoint / credential metadata validation
- [ ] runtime adapters for each protocol family
- [ ] task-level provider selection
- [ ] automatic fallback policy with explicit cost/risk constraints

### Milestone 2: Windows-first runtime

- [ ] Windows CI parity for runtime integration tests
- [ ] PowerShell-aware command execution
- [ ] proxy inheritance and WebSocket connectivity checks
- [ ] PTY/path/encoding regression suite

### Milestone 3: durable autonomous work

- [ ] resumable task journal
- [ ] checkpointed tool execution
- [ ] Git worktree isolation for parallel agents
- [ ] independent verification gate before completion

### Milestone 4: agent supply-chain safety

- [ ] MCP / Skill provenance gate
- [ ] install-command policy
- [ ] signed or pinned dependency metadata where available
- [ ] optional ARD Guard integration

## Upstream and licensing

ForgePilot is an independent project and is not affiliated with or endorsed by xAI/SpaceXAI.

The current codebase integrates with Grok Build through public command-line and Agent Client Protocol interfaces and does not currently redistribute the Grok Build source tree. Grok Build is Apache-2.0 licensed. See `NOTICE` and `docs/UPSTREAM_LICENSE_REVIEW.md` for attribution and license review.

This repository is licensed under Apache-2.0. See `LICENSE`.
