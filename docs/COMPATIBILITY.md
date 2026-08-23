# Grok Build and provider compatibility

ForgePilot is an independent project. It is not affiliated with or endorsed by xAI/SpaceXAI, OpenAI, or Anthropic.

## Grok Build execution surfaces

Integration is through **public** Grok Build surfaces only:

| Surface | ForgePilot module | Status |
|---|---|---|
| `grok -p` headless + streaming-json | `runHeadless` | implemented and used by `forgepilot run` |
| ACP stdio (`grok agent stdio`) | `AcpClient` | implemented |
| Permission modes default/auto/bypass | `SAFE` / `AUTO` / `FULL` | implemented |
| Hard deny rules | `HARD_DENY_RULES` | implemented |
| Fixed session id + resume (`-s` / `-r`) | dispatch + durable journal | implemented |
| Independent post-run verification | `verifyProject` + completion gate | implemented for declared Node scripts |
| Source-tree fork of grok-build | — | out of scope |

## Direct provider protocol adapters

A protocol adapter means ForgePilot can speak that API and normalize its stream. It does **not** automatically mean the provider can autonomously edit a repository through ForgePilot.

| Protocol | Adapter | Transport | Coding-tool loop |
|---|---|---:|---:|
| OpenAI-compatible Chat Completions | `openaiCompatibleAdapter` | ✅ | ⏳ pending |
| OpenAI Responses | `openaiResponsesAdapter` | ✅ | ⏳ pending |
| Anthropic Messages | `anthropicMessagesAdapter` | ✅ | ⏳ pending |

Until provider-native tool loops are implemented, `forgepilot run --provider openai`, `anthropic`, or `local` fails explicitly instead of silently degrading to a text-only response and pretending repository work happened.
