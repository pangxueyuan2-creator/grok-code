import type { Activity, ProviderProfile, ProviderProtocol } from "@grok-code/core";

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AdapterTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AdapterRequest {
  messages: ModelMessage[];
  tools?: AdapterTool[];
  timeoutMs: number;
  maxRetries: number;
}

export interface AdapterContext {
  profile: ProviderProfile;
  apiKey: string;
  request: AdapterRequest;
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

/**
 * Protocol adapters MUST emit the shared Activity model.
 * Vendor-specific response shapes stay inside the adapter.
 */
export interface ProtocolAdapter {
  readonly protocol: ProviderProtocol;
  stream(ctx: AdapterContext): AsyncIterable<Activity>;
}

export class AdapterError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdapterError";
    this.status = status;
  }
}
