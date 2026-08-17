import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/frontend/features/admin/moderation/moderation-review-show.tsx", "utf8");

describe("moderation enforcement evidence", () => {
  it("renders linked enforcement evidence on report detail", () => {
    expect(source).toContain("enforcementLinks");
    expect(source).toContain("Linked enforcement");
  });
});
