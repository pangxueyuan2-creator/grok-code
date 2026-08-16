import { describe, expect, it } from "vitest";
import { classifyCommand, classifyTool } from "../src/risk.js";

describe("command risk classification", () => {
  it("flags destructive system commands as CRITICAL", () => {
    expect(classifyCommand("sudo rm -rf /").level).toBe("CRITICAL");
    expect(classifyCommand("git reset --hard").level).toBe("CRITICAL");
    expect(classifyCommand("git push --force origin main").level).toBe("CRITICAL");
  });
  it("flags deletions as HIGH", () => {
    expect(classifyCommand("rm -rf node_modules").level).toBe("HIGH");
    expect(classifyCommand("del build").level).toBe("HIGH");
    expect(classifyCommand("git rebase main").level).toBe("HIGH");
  });
  it("flags installs as MEDIUM", () => {
    expect(classifyCommand("npm install httpx").level).toBe("MEDIUM");
    expect(classifyCommand("pip install requests").level).toBe("MEDIUM");
    expect(classifyCommand("git checkout -b feat/x").level).toBe("MEDIUM");
  });
  it("read-only commands are LOW", () => {
    expect(classifyCommand("npm test").level).toBe("LOW");
    expect(classifyCommand("git status").level).toBe("LOW");
    expect(classifyCommand("").level).toBe("LOW");
  });
});

describe("tool risk classification", () => {
  it("reads are LOW", () => {
    expect(classifyTool("read_file").level).toBe("LOW");
    expect(classifyTool("grep").level).toBe("LOW");
  });
  it("edits are MEDIUM", () => {
    expect(classifyTool("search_replace").level).toBe("MEDIUM");
    expect(classifyTool("write_file").level).toBe("MEDIUM");
  });
  it("deletes are HIGH", () => {
    expect(classifyTool("delete_files").level).toBe("HIGH");
  });
  it("shell commands inherit command classification", () => {
    expect(classifyTool("run_terminal_cmd", { command: "sudo rm -rf /" }).level).toBe("CRITICAL");
    expect(classifyTool("run_terminal_cmd", { command: "npm test" }).level).toBe("LOW");
  });
});
