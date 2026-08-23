import { isLoopbackUrl, type ProviderProfile, type ProviderRegistry } from "./provider.js";
import type { TaskProviderBinding } from "./task.js";

export interface RoutingPolicy {
  timeoutMs: number;
  maxRetries: number;
  /** Explicit ordered fallbacks. Empty means no fallback at all. */
  fallbackProviderIds: readonly string[];
}

export const DEFAULT_ROUTING: RoutingPolicy = {
  timeoutMs: 60_000,
  maxRetries: 2,
  fallbackProviderIds: [],
};

export class RoutingError extends Error {
  readonly code: "REMOTE_FORBIDDEN" | "FALLBACK_FORBIDDEN" | "NO_FALLBACK" | "MISSING_CREDENTIAL";

  constructor(
    message: string,
    code: "REMOTE_FORBIDDEN" | "FALLBACK_FORBIDDEN" | "NO_FALLBACK" | "MISSING_CREDENTIAL",
  ) {
    super(message);
    this.name = "RoutingError";
    this.code = code;
  }
}

export function bindTaskProvider(
  registry: ProviderRegistry,
  input: {
    providerId: string;
    model?: string;
    allowFallback: boolean;
    allowRemote: boolean;
  },
): TaskProviderBinding {
  const profile = registry.get(input.providerId);
  const binding: TaskProviderBinding = {
    providerId: profile.id,
    model: input.model?.trim() || profile.model,
    allowFallback: input.allowFallback,
    allowRemote: input.allowRemote,
  };
  assertRemoteAllowed(profile, binding);
  return binding;
}

export function selectProvider(
  registry: ProviderRegistry,
  binding: TaskProviderBinding,
): ProviderProfile {
  const profile = registry.get(binding.providerId);
  if (profile.model === binding.model) return profile;
  return Object.freeze({ ...profile, model: binding.model });
}

export function assertRemoteAllowed(profile: ProviderProfile, binding: TaskProviderBinding): void {
  if (binding.allowRemote) return;
  if (isLoopbackUrl(profile.baseUrl)) return;
  throw new RoutingError(
    `Task forbids remote providers; ${profile.id} is not a loopback endpoint.`,
    "REMOTE_FORBIDDEN",
  );
}

/**
 * Fallback is never silent. The task must opt in, and the next provider must
 * be listed explicitly on the routing policy.
 */
export function resolveFallback(
  registry: ProviderRegistry,
  binding: TaskProviderBinding,
  policy: RoutingPolicy,
  failedProviderId: string,
): ProviderProfile {
  if (!binding.allowFallback) {
    throw new RoutingError(
      `Provider ${failedProviderId} failed; this task forbids fallback (cost/privacy constraint).`,
      "FALLBACK_FORBIDDEN",
    );
  }
  const nextId = policy.fallbackProviderIds.find((id) => id !== failedProviderId);
  if (!nextId) {
    throw new RoutingError(
      `Provider ${failedProviderId} failed; no explicit fallback is configured.`,
      "NO_FALLBACK",
    );
  }
  const next = registry.get(nextId);
  assertRemoteAllowed(next, binding);
  return next;
}

export function readApiKey(
  profile: ProviderProfile,
  env: Record<string, string | undefined>,
): string {
  const value = env[profile.apiKeyEnv];
  if (!value) {
    throw new RoutingError(
      `Missing credential in environment variable ${profile.apiKeyEnv}.`,
      "MISSING_CREDENTIAL",
    );
  }
  return value;
}

export function redactSecret(text: string, secret?: string): string {
  if (!secret) return text;
  return text.split(secret).join("[redacted]");
}
