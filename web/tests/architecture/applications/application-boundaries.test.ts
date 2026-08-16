import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("submitted candidate boundaries", () => {
  it("keeps ranking and score behavior out of the Group 1 list", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/frontend/features/recruiter-applications/submitted-candidates-list.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/aiMatchScore|finalScore|ranking|scoreFilter/i);
    expect(source).toMatch(/Scores are not part of this view/);
  });
});
