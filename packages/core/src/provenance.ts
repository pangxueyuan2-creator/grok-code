export type InstallKind = "mcp" | "skill";

export interface InstallCandidate {
  kind: InstallKind;
  name: string;
  source: string;
  digest?: string;
  pinned?: boolean;
}

export interface ProvenanceResult {
  ok: boolean;
  reason: string;
}

const SHA256 = /^[a-f0-9]{64}$/i;

export function checkInstallProvenance(candidate: InstallCandidate): ProvenanceResult {
  if (!candidate.name.trim()) {
    return { ok: false, reason: "Install name is required." };
  }

  let url: URL | undefined;
  try {
    url = new URL(candidate.source);
  } catch {
    url = undefined;
  }

  if (url) {
    if (url.protocol === "http:") {
      return { ok: false, reason: "Remote MCP/Skill installs must use HTTPS." };
    }
    if (url.protocol !== "https:" && url.protocol !== "file:") {
      return { ok: false, reason: `Unsupported install source protocol: ${url.protocol}` };
    }
    if (url.protocol === "https:" && !candidate.digest) {
      return { ok: false, reason: "Remote installs require a pinned sha256 digest." };
    }
  }

  if (candidate.digest && !SHA256.test(candidate.digest)) {
    return { ok: false, reason: "Digest must be a sha256 hex string." };
  }

  if (!candidate.pinned) {
    return { ok: false, reason: "Unpinned MCP/Skill installs are refused (fail closed)." };
  }

  return { ok: true, reason: "Provenance checks passed." };
}
