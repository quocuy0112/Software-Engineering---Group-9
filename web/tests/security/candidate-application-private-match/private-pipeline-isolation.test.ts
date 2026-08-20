import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true });
  return entries
    .filter((entry): entry is string => typeof entry === "string" && /\.(?:ts|tsx)$/u.test(entry))
    .map((entry) => resolve(root, entry));
}

describe("private pipeline security boundary", () => {
  it("keeps employer APIs, exports, and search code unaware of private checks", async () => {
    const roots = [
      "backend/admin",
      "backend/recruiter-header",
      "backend/applications",
      "backend/services/jobs",
      "backend/repositories/admin",
      "backend/repositories/recruiter",
      "backend/repositories/jobs",
      "app/api/admin",
      "app/api/recruiter",
      "app/api/employer-verifications",
      "app/api/jobs",
      "app/recruiter",
    ].map((root) => resolve(sourceRoot, root));
    const files = (await Promise.all(roots.map((root) => sourceFiles(root).catch(() => [])))).flat();
    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (/(?:private[-_]cv[-_]match|PrivateCvMatch|pmc_)/iu.test(content)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("keeps worker diagnostics content-free", async () => {
    const worker = await readFile(resolve(sourceRoot, "backend/private-cv-match/private-match-worker.ts"), "utf8");
    expect(worker).toContain("checkId: input.checkId");
    expect(worker).toContain("state: input.state");
    expect(worker).toContain("failureCode");
    expect(worker).not.toContain("cvText: input");
    expect(worker).not.toContain("rawProviderResponse");
  });
});
