import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("in-app notification performance harness", () => {
  it("uses a bounded production-shaped fixture and release targets", () => {
    const harness = readFileSync(
      "scripts/measure-in-app-notification-performance.mjs",
      "utf8",
    );
    expect(harness).toContain("const fixtureSize = 5_000");
    expect(harness).toContain("const measuredSamples = 30");
    expect(harness).toContain("const pageTargetMs = 500");
    expect(harness).toContain("const unreadTargetMs = 500");
    expect(harness).toContain("finally");
    expect(harness).toContain("userAccount.deleteMany");
  });
});
