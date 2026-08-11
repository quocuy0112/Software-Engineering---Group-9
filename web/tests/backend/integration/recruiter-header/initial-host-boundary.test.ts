import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recruiter header initial host boundary", () => {
  it("guards the workspace layout before context access", async () => {
    const layout = await readFile(
      resolve(process.cwd(), "src/app/(workspace)/layout.tsx"),
      "utf8",
    );
    expect(layout.indexOf("if (!isCandidateRequestHost")).toBeLessThan(
      layout.indexOf("const context = await getWorkspaceContext"),
    );
    expect(layout).toContain("notFound");
  });
});
