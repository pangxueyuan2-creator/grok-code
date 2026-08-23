export interface SecretHit {
  kind: string;
  start: number;
  end: number;
}

const PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "openai", re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "xai", re: /\bxai-[A-Za-z0-9_-]{16,}\b/g },
  { kind: "github", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { kind: "aws-access", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "bearer", re: /\bBearer\s+[A-Za-z0-9._\-+/=]{12,}\b/gi },
  {
    kind: "assignment",
    re: /\b(?:api[_-]?key|secret|password|token|authorization)\s*[:=]\s*["']?[^\s"']{8,}/gi,
  },
];

export function scanForSecrets(text: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null = re.exec(text);
    while (match) {
      hits.push({ kind, start: match.index, end: match.index + match[0].length });
      match = re.exec(text);
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function redactSecrets(text: string): string {
  const hits = scanForSecrets(text);
  if (hits.length === 0) return text;
  let out = "";
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    out += text.slice(cursor, hit.start);
    out += `[redacted:${hit.kind}]`;
    cursor = hit.end;
  }
  out += text.slice(cursor);
  return out;
}

export function containsSecrets(text: string): boolean {
  return scanForSecrets(text).length > 0;
}
