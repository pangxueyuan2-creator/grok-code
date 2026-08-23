# Changelog

All notable changes to ForgePilot (repository: grok-code) are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-08-23

### Added

- Real autonomous coding dispatch through Grok Build on the xAI path.
- Explicit `forgepilot plan` dry-run command; `run` / `dispatch` now execute instead of only printing a plan.
- Provider-neutral profiles for xAI, OpenAI, Anthropic, and OpenAI-compatible loopback.
- Protocol adapters: OpenAI-compatible Chat Completions, OpenAI Responses, Anthropic Messages.
- Task-level provider/model binding with explicit timeout/retry policy and no silent provider switching.
- Durable append-only JSONL task journals with fixed Grok session ids for interrupted-task resume.
- `forgepilot resume <taskId>` backed by persisted journal state rather than in-memory-only state.
- Independent post-run verification using declared Node project scripts (`typecheck`, `lint`, `test`, `build`).
- Fail-closed completion gate: `DONE` requires clean provider execution plus independent verification evidence.
- MCP/Skill install provenance checks.
- Redacted task bundle import/export.
- Windows quoting, executable resolution, CRLF, Unicode path helpers, and cross-platform CI.
- Git worktree planning for parallel agents.

### Changed

- Direct OpenAI, Anthropic, and local/OpenAI-compatible provider paths now fail explicitly for autonomous coding dispatch until their provider-native tool loops are implemented.
- README and compatibility documentation now distinguish protocol transport support from autonomous repository-editing support.

### Security

- Provider metadata stores environment-variable names, never raw keys.
- Persisted journals strip API keys, bearer tokens, and hidden reasoning fields before disk writes.
- Remote plaintext HTTP is rejected; loopback HTTP is allowed for local runtimes.
- Critical destructive commands stay denied in FULL mode.
- Unknown tools fail closed.
