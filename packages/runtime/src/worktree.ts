/**
 * Git worktree isolation for parallel agents. This module builds commands
 * rather than spawning git so tests stay deterministic and Windows-safe.
 */

export interface WorktreePlan {
  branch: string;
  path: string;
  addArgs: string[];
  removeArgs: string[];
}

function slug(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "task";
}

export function planWorktree(taskId: string, repoRoot: string): WorktreePlan {
  const id = slug(taskId);
  const branch = `forgepilot/${id}`;
  const path = `${repoRoot.replace(/[\\/]+$/, "")}/.forgepilot/worktrees/${id}`;
  return {
    branch,
    path,
    addArgs: ["git", "worktree", "add", "-B", branch, path, "HEAD"],
    removeArgs: ["git", "worktree", "remove", "--force", path],
  };
}
