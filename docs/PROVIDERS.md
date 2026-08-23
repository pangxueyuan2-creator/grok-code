# Provider protocols

ForgePilot models **vendor** and **protocol** separately.

| Provider kind | Default protocol | Credential env | Default base URL |
|---|---|---|---|
| `xai` | `openai-compatible` | `XAI_API_KEY` | `https://api.x.ai/v1` |
| `openai` | `openai-responses` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| `anthropic` | `anthropic-messages` | `ANTHROPIC_API_KEY` | `https://api.anthropic.com/v1` |
| `openai-compatible` | `openai-compatible` | caller-supplied env name | required |

Adapters convert vendor payloads into the shared `Activity` model. Task objects never store OpenAI, Anthropic, or xAI response shapes.

## Routing rules

- Task-level `providerId` + `model` win over profile defaults.
- Fallback is **opt-in** (`allowFallback`) and must list explicit provider ids.
- Silent provider switching is a bug, not a feature.
- `allowRemote: false` permits loopback HTTP only (Ollama and similar).
- Remote plaintext HTTP is rejected at profile creation.
- Journals record `apiKeyEnv`, never the secret.

## Timeouts and retries

Default policy: 60s timeout, two retries on 429/5xx for the **same** provider. Exhausting retries does not pick another vendor unless the task opted into fallback.
