/**
 * Change domain model: every file modification is classified by owner so the
 * Change Center can guarantee that reverting Grok Code work never destroys
 * the user's own pre-existing edits.
 */

export type ChangeKind = "ADD" | "MODIFY" | "DELETE" | "RENAME";
export type ChangeOwner = "USER" | "GROK_CODE" | "UNKNOWN";

export interface FileChange {
  /** Repo-relative path with forward slashes (Windows-safe canonical form). */
  path: string;
  kind: ChangeKind;
  owner: ChangeOwner;
  additions: number;
  deletions: number;
  /** First/last line numbers of the first hunk, when available. */
  firstLine?: number;
  lastLine?: number;
}

export interface ChangeSummary {
  files: number;
  additions: number;
  deletions: number;
  byPath: Map<string, FileChange>;
  userFiles: string[];
  grokFiles: string[];
}

export function emptySummary(): ChangeSummary {
  return {
    files: 0,
    additions: 0,
    deletions: 0,
    byPath: new Map(),
    userFiles: [],
    grokFiles: [],
  };
}

export function addChange(summary: ChangeSummary, change: FileChange): ChangeSummary {
  if (summary.byPath.has(change.path)) {
    throw new Error(`Duplicate change for path ${change.path}`);
  }
  const byPath = new Map(summary.byPath);
  byPath.set(change.path, change);
  const userFiles = change.owner === "USER" ? [...summary.userFiles, change.path] : summary.userFiles;
  const grokFiles =
    change.owner === "GROK_CODE" ? [...summary.grokFiles, change.path] : summary.grokFiles;
  return {
    files: byPath.size,
    additions: summary.additions + change.additions,
    deletions: summary.deletions + change.deletions,
    byPath,
    userFiles,
    grokFiles,
  };
}

function canonicalSlashes(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Normalize a Windows or POSIX path to a forward-slash form, relative to repoRoot when supplied. */
export function normalizePath(path: string, repoRoot?: string): string {
  const normalized = canonicalSlashes(path);

  if (repoRoot !== undefined) {
    const root = canonicalSlashes(repoRoot);
    const windowsStyle = /^[A-Za-z]:/.test(normalized) || /^[A-Za-z]:/.test(root);
    const comparablePath = windowsStyle ? normalized.toLowerCase() : normalized;
    const comparableRoot = windowsStyle ? root.toLowerCase() : root;

    if (comparablePath === comparableRoot) return "";
    if (comparablePath.startsWith(`${comparableRoot}/`)) {
      return normalized.slice(root.length + 1);
    }
  }

  return normalized.replace(/^[A-Za-z]:/, "").replace(/^\/+/, "").replace(/^\.\//, "");
}
