# Contributing to Grok Code

Thanks for your interest. Grok Code is an independent open-source project built
on top of Grok Build's public interfaces.

## Development setup

Requirements: Node.js >= 20, pnpm >= 9, git. Grok Build (`grok` CLI) is only
required for integration tests and dogfooding.

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## Workflow

1. Open an issue describing the bug or feature (or comment on an existing one).
2. Branch from `main` using `feat/*`, `fix/*`, `ux/*`, or `test/*`.
3. Keep commits focused with conventional prefixes (see CHANGELOG).
4. Add tests for the behavior you change; unit tests must pass without network.
5. Open a PR. CI runs lint, typecheck, unit tests, and build on Windows, Linux,
   and macOS.

Integration tests that call the real `grok` binary are tagged `@integration`
and run only when `GROKCODE_INTEGRATION=1` is set, so contributors without a
grok install or API access can still contribute.

## Code of Conduct

See CODE_OF_CONDUCT.md. Be kind.
