import { describe, expect, it } from "vitest";
import {
  detectShell,
  normalizeNewlines,
  quoteCmd,
  quoteForShell,
  quotePowerShell,
  windowsExecutableCandidates,
} from "../src/windows.js";
import { planWorktree } from "../src/worktree.js";

describe("windows quoting", () => {
  it("quotes cmd metacharacters and empty args", () => {
    expect(quoteCmd("simple")).toBe("simple");
    expect(quoteCmd("")).toBe('""');
    expect(quoteCmd("a b")).toBe('"a b"');
    expect(quoteCmd('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes PowerShell with doubled single quotes", () => {
    expect(quotePowerShell("C:\\Users\\测试")).toBe("'C:\\Users\\测试'");
    expect(quotePowerShell("it's")).toBe("'it''s'");
  });

  it("detects posix off Windows and cmd/powershell on Windows", () => {
    expect(detectShell("linux")).toBe("posix");
    expect(detectShell("win32", { ComSpec: "C:\\\\Windows\\\\system32\\\\cmd.exe" })).toBe("cmd");
    expect(detectShell("win32", { PSModulePath: "C:\\\\x" })).toBe("powershell");
  });

  it("resolves executable extensions", () => {
    expect(windowsExecutableCandidates("grok")).toEqual(["grok.exe", "grok.cmd", "grok.bat", "grok"]);
    expect(windowsExecutableCandidates("grok.exe")).toEqual(["grok.exe"]);
  });

  it("round-trips CRLF for Windows fixtures", () => {
    expect(normalizeNewlines("a\nb\n", "crlf")).toBe("a\r\nb\r\n");
    expect(normalizeNewlines("a\r\nb\r\n", "lf")).toBe("a\nb\n");
  });

  it("keeps unicode workspace paths in worktree plans", () => {
    const plan = planWorktree("task 测试", "D:\\\\repos\\\\项目");
    expect(plan.path).toContain("项目");
    expect(plan.addArgs[0]).toBe("git");
    expect(quoteForShell(plan.path, "cmd")).toContain("项目");
  });
});
