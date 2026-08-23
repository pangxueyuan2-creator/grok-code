# Changelog

All notable changes to ForgePilot (repository: grok-code) are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Provider-neutral profiles for xAI, OpenAI, Anthropic, and OpenAI-compatible loopback.
- Protocol adapters: OpenAI-compatible Chat Completions, OpenAI Responses, Anthropic Messages.
- Task-level provider/model binding with explicit timeout/retry/fallback policy.
- Append-only journal (schema v1) that redacts secrets and drops hidden chain-of-thought.
- Fail-closed permission policy; independent verification gate before `DONE`.
- MCP/Skill install provenance checks.
- Redacted task bundle import/export.
- Windows quoting, executable resolution, CRLF, and Unicode path helpers.
- Git worktree planning for parallel agents.
- `forgepilot` CLI (`providers`, `run`, `resume`, `compat`).

### Security

- Provider metadata stores environment-variable names, never raw keys.
- Remote plaintext HTTP is rejected; loopback HTTP is allowed for local runtimes.
- Critical destructive commands stay denied in FULL mode.
