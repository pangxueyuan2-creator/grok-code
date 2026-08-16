import { describe, expect, it } from "vitest";
import { addChange, emptySummary, normalizePath } from "../src/change.js";

describe("change summary", () => {
  it("accumulates stats and separates owners", () => {
    let s = emptySummary();
    s = addChange(s, {
      path: "src/auth.ts",
      kind: "MODIFY",
      owner: "USER",
      additions: 3,
      deletions: 1,
    });
    s = addChange(s, {
      path: "src/login.tsx",
      kind: "ADD",
      owner: "GROK_CODE",
      additions: 67,
      deletions: 0,
    });
    expect(s.files).toBe(2);
    expect(s.additions).toBe(70);
    expect(s.deletions).toBe(1);
    expect(s.userFiles).toEqual(["src/auth.ts"]);
    expect(s.grokFiles).toEqual(["src/login.tsx"]);
  });

  it("rejects duplicate paths", () => {
    let s = emptySummary();
    s = addChange(s, { path: "a.ts", kind: "ADD", owner: "GROK_CODE", additions: 1, deletions: 0 });
    expect(() =>
      addChange(s, { path: "a.ts", kind: "MODIFY", owner: "GROK_CODE", additions: 2, deletions: 0 }),
    ).toThrow(/Duplicate/);
  });
});

describe("normalizePath", () => {
  it("converts windows separators and drive prefixes", () => {
    expect(normalizePath("C:\\repo\\src\\a.ts")).toBe("src/a.ts");
  });
  it("keeps posix paths", () => {
    expect(normalizePath("src/a.ts")).toBe("src/a.ts");
  });
});
