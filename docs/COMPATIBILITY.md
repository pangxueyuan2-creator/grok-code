# Grok Build compatibility matrix

ForgePilot is an independent project. It is not affiliated with or endorsed by xAI/SpaceXAI.

Integration is through **public** Grok Build surfaces only:

| Surface | ForgePilot module | Status |
|---|---|---|
| `grok -p` headless + streaming-json | `runHeadless` | implemented |
| ACP stdio (`grok agent stdio`) | `AcpClient` | implemented |
| Permission modes default/auto/bypass | `SAFE` / `AUTO` / `FULL` | implemented |
| Hard deny rules | `HARD_DENY_RULES` | implemented |
| Session resume (`-r` / `-c`) | `HeadlessOptions` | implemented |
| Source-tree fork of grok-build | — | out of scope |

Protocol families beyond Grok Build:

| Protocol | Adapter | Status |
|---|---|---|
| OpenAI-compatible Chat Completions | `openaiCompatibleAdapter` | implemented |
| OpenAI Responses | `openaiResponsesAdapter` | implemented |
| Anthropic Messages | `anthropicMessagesAdapter` | implemented |
