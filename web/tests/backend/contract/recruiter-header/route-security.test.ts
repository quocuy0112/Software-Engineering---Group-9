import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recruiter header route security contract", () => {
  it("keeps wrong-host and auth errors neutral and no-store", async () => {
    const route = await readFile(
      resolve(process.cwd(), "src/app/api/recruiter/header-status/route.ts"),
      "utf8",
    );
    expect(route).toContain("Cache-Control");
    expect(route).toContain("UNAUTHORIZED");
    expect(route).toContain("UNAVAILABLE");
    expect(route).toContain("STATUS_UNAVAILABLE");
    expect(route.indexOf("if (!isCandidateRequestHost")).toBeLessThan(
      route.indexOf("const current = await requireSession"),
    );
  });
});
