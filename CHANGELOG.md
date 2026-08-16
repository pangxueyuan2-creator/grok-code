# Changelog

All notable changes to Grok Code are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Project scaffold: pnpm workspace, TypeScript packages, Vitest, Biome, CI.
- `packages/core`: domain model (tasks, changes, verification, risk levels).
- `packages/runtime`: thin Grok Build integration (headless runner, ACP client,
  Windows system-proxy forwarding).
- `packages/git-safety`: dirty worktree protection, safe checkpoints, diff
  summaries, change ownership classification.
- `packages/project`: automatic project understanding (languages, framework,
  package manager, tests, git state).
- `packages/sessions`: session history and resume on top of real grok sessions.
- `packages/permissions`: SAFE/AUTO/FULL modes mapped to grok permission rules
  with a LOW/MEDIUM/HIGH/CRITICAL risk classifier.
- `apps/cli`: the `grok-code` command line.
- Governance docs: README, LICENSE (Apache-2.0), NOTICE, SECURITY,
  CONTRIBUTING, CODE_OF_CONDUCT, upstream license review.
