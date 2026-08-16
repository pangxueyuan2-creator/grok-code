# Upstream License Review: xai-org/grok-build

Review date: 2026-08-16
Reviewer: Grok Code project (automated fetch + human-in-the-loop verification)
Upstream repository: https://github.com/xai-org/grok-build
Upstream SOURCE_REV at review time: `84ae1223e57a5048afb570d74d45c051fa604982`
Upstream LICENSE fetched via GitHub API (`repos/xai-org/grok-build/license`): **Apache-2.0**

## What Grok Code takes from upstream

Nothing is copied into this repository. Grok Code is a **thin integration** that:

1. Executes the locally installed `grok` binary (Grok Build CLI, installed by the user
   from official channels) as a subprocess.
2. Speaks to it over its **public, documented interfaces**:
   - Headless mode: `grok -p --output-format [plain|json|streaming-json|streaming-messages-json]`
   - Agent mode: `grok agent stdio` (Agent Client Protocol / JSON-RPC 2.0)
   - Session management: `grok sessions`, `grok -r/--continue`
3. Reads session data that the user's own grok installation persists locally.

Because we do not redistribute, modify, or embed upstream source code, Grok Code is
not a "Derivative Work" of Grok Build in the Apache-2.0 sense; it is a separate work
that interoperates with it through its public interfaces (Apache-2.0 §2 grant is
therefore not even required for our code, but the terms below are respected anyway).

## What Apache-2.0 permits (for completeness)

- Use, reproduction, modification, and distribution of the upstream work, including
  creation of Derivative Works, with or without fee (§2).
- Making, using, and selling the work under the patent grant (§3).

## Requirements that would apply if we ever DID redistribute upstream code

Apache-2.0 §4 imposes these conditions; **we track them so that any future decision
to vendor or fork remains compliant**:

- (a) Include a copy of the Apache-2.0 license with any redistribution.
- (b) Carry prominent notices in modified files stating that they were changed.
- (c) Retain all copyright/patent/trademark/attribution notices from the source form.
- (d) If upstream ships a NOTICE file, include a readable copy of its attribution
  notices (we would need `THIRD-PARTY-NOTICES` and the crate-local notices, e.g.
  `crates/codegen/xai-grok-tools/THIRD_PARTY_NOTICES.md`).

## Restrictions and cautions

- **Trademarks** (§6): Apache-2.0 grants no trademark license. Grok Code must not
  imply endorsement by xAI / SpaceXAI. Our README and docs carry an explicit
  independence statement (see NOTICE and README "Upstream relationship").
- **No patent license for litigation** (§3): irrelevant to a thin integration.
- Upstream README states external contributions are not accepted by Grok Build;
  that does not affect our independent project.
- Grok Build vendors third-party code (openai/codex, sst/opencode ports, Mermaid
  stack) under their own licenses. We must NEVER copy those into this repo; doing
  so would bring in their license terms.

## Decision

- **Thin integration only.** No vendoring, no forking of upstream source.
- If a future milestone genuinely requires a runtime patch, the patch goes into a
  clearly marked `third_party/` directory with the full NOTICE chain, per §4.
- This review is re-run whenever the pinned upstream revision changes.

## Attestation of review

The full Apache-2.0 text was fetched from the upstream repository on 2026-08-16 and
matched the standard Apache-2.0 license text (copyright header: "Copyright
2023-2026 SpaceXAI").
