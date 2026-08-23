import type { ProviderProtocol } from "@grok-code/core";
import { anthropicMessagesAdapter } from "./anthropic-messages.js";
import { openaiCompatibleAdapter } from "./openai-compat.js";
import { openaiResponsesAdapter } from "./openai-responses.js";
import type { ProtocolAdapter } from "./types.js";

export * from "./types.js";
export { openaiCompatibleAdapter } from "./openai-compat.js";
export { openaiResponsesAdapter } from "./openai-responses.js";
export { anthropicMessagesAdapter } from "./anthropic-messages.js";

const ADAPTERS: Record<ProviderProtocol, ProtocolAdapter> = {
  "openai-compatible": openaiCompatibleAdapter,
  "openai-responses": openaiResponsesAdapter,
  "anthropic-messages": anthropicMessagesAdapter,
};

export function adapterFor(protocol: ProviderProtocol): ProtocolAdapter {
  const adapter = ADAPTERS[protocol];
  if (!adapter) throw new Error(`No adapter registered for protocol ${protocol}`);
  return adapter;
}
