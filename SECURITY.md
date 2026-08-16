# Security Policy

Grok Code is an agent that can execute code on your machine. Security is a core
product requirement, not an afterthought.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.
Report them privately to the repository maintainers via GitHub's
"Report a vulnerability" flow (Security → Advisories) or by contacting a
maintainer directly. You will receive a response within 7 days.

## What we consider in scope

- Permission bypass (tools executing without the configured approval level)
- Path traversal / writes outside the project working directory
- Secret or credential leakage (logs, transcripts, diffs, exported bundles)
- Terminal escape sequence injection from tool output
- Prompt injection that escalates permissions
- Unsafe checkpoint/restore that destroys user data

## Design guarantees we test

- Grok Code never auto-approves CRITICAL-risk actions in SAFE or AUTO mode.
- Checkpoint restore never uses `git reset --hard` or `git clean`.
- Pre-existing user changes (dirty worktree) are classified separately from
  Grok Code changes and are never reverted together.
- Credentials matching known secret patterns are redacted from all persisted
  output (see `packages/security`).
