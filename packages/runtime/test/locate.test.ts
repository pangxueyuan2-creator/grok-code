import { describe, expect, it } from "vitest";
import { parseGrokVersion } from "../src/locate.js";

describe("parseGrokVersion", () => {
  it("parses the installed-version format", () => {
    expect(parseGrokVersion("grok 1.0.4 (d846eb93d9) [stable]")).toEqual({
      version: "1.0.4",
      sha: "d846eb93d9",
      channel: "stable",
    });
  });
  it("handles bare versions", () => {
    expect(parseGrokVersion("1.2.3")).toEqual({ version: "1.2.3" });
  });
  it("handles garbage", () => {
    expect(parseGrokVersion("")).toEqual({ version: "unknown" });
  });
});
