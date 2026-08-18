export type ProviderKind = "xai" | "openai" | "anthropic" | "openai-compatible";

export type ProviderProtocol =
  | "openai-compatible"
  | "openai-responses"
  | "anthropic-messages";

export interface ProviderProfile {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly protocol: ProviderProtocol;
  readonly model: string;
  readonly baseUrl: string;
  /** Name of the environment variable containing the credential. Never the secret itself. */
  readonly apiKeyEnv: string;
}

export interface ProviderProfileInput {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly model: string;
  readonly baseUrl?: string;
  readonly apiKeyEnv?: string;
  readonly protocol?: ProviderProtocol;
}

const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;
const ID = /^[a-z0-9][a-z0-9._-]*$/;

const BUILTIN_DEFAULTS: Record<
  Exclude<ProviderKind, "openai-compatible">,
  Pick<ProviderProfile, "baseUrl" | "apiKeyEnv" | "protocol">
> = {
  xai: {
    baseUrl: "https://api.x.ai/v1",
    apiKeyEnv: "XAI_API_KEY",
    protocol: "openai-compatible",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    protocol: "openai-responses",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    protocol: "anthropic-messages",
  },
};

function validateBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Do not echo the raw value: malformed URLs can themselves contain credentials.
    throw new Error("Invalid provider base URL.");
  }

  if (url.username || url.password) {
    throw new Error("Provider base URL must not contain embedded credentials.");
  }

  const isLoopback =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("Provider base URL must use HTTPS; HTTP is allowed only for loopback endpoints.");
  }

  return url.toString().replace(/\/$/, "");
}

export function createProviderProfile(input: ProviderProfileInput): ProviderProfile {
  if (!ID.test(input.id)) {
    throw new Error(`Invalid provider id: ${input.id}`);
  }
  if (!input.model.trim()) {
    throw new Error("Provider model must not be empty.");
  }

  const defaults = input.kind === "openai-compatible" ? undefined : BUILTIN_DEFAULTS[input.kind];
  const baseUrl = input.baseUrl ?? defaults?.baseUrl;
  const apiKeyEnv = input.apiKeyEnv ?? defaults?.apiKeyEnv;
  const protocol = input.protocol ?? defaults?.protocol ?? "openai-compatible";

  if (!baseUrl) {
    throw new Error("Custom OpenAI-compatible providers must define baseUrl.");
  }
  if (!apiKeyEnv || !ENV_NAME.test(apiKeyEnv)) {
    throw new Error("apiKeyEnv must be an environment-variable name, not a credential value.");
  }

  return Object.freeze({
    id: input.id,
    kind: input.kind,
    protocol,
    model: input.model.trim(),
    baseUrl: validateBaseUrl(baseUrl),
    apiKeyEnv,
  });
}

export class ProviderRegistry {
  readonly #profiles = new Map<string, ProviderProfile>();

  constructor(profiles: readonly ProviderProfile[] = []) {
    for (const profile of profiles) this.register(profile);
  }

  register(profile: ProviderProfile): void {
    if (this.#profiles.has(profile.id)) {
      throw new Error(`Provider already registered: ${profile.id}`);
    }
    this.#profiles.set(profile.id, profile);
  }

  get(id: string): ProviderProfile {
    const profile = this.#profiles.get(id);
    if (!profile) throw new Error(`Unknown provider: ${id}`);
    return profile;
  }

  list(): readonly ProviderProfile[] {
    return [...this.#profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
