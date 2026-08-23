import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverVerificationCommands } from "../src/verify-project.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("discoverVerificationCommands", () => {
  it("uses only verification scripts already declared by the project", () => {
    const root = mkdtempSync(join(tmpdir(), "forgepilot-verify-"));
    roots.push(root);
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run", build: "tsc", deploy: "dangerous-deploy" } }),
    );
    writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    const commands = discoverVerificationCommands(root);
    expect(commands.map((item) => item.kind)).toEqual(["test", "build"]);
    expect(commands.every((item) => item.command === "pnpm")).toBe(true);
    expect(commands.flatMap((item) => item.args)).not.toContain("deploy");
  });

  it("returns no invented checks for projects without declared scripts", () => {
    const root = mkdtempSync(join(tmpdir(), "forgepilot-verify-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    expect(discoverVerificationCommands(root)).toEqual([]);
  });
});
