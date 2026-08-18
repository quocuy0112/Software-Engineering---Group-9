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

describe("private CV match isolation", () => {
  it("blocks employer, recruiter, and administrator modules from importing private data", async () => {
    const roots = [
    resolve(sourceRoot, "backend/admin"),
    resolve(sourceRoot, "backend/recruiter"),
    resolve(sourceRoot, "backend/recruiter-header"),
    resolve(sourceRoot, "backend/applications"),
    resolve(sourceRoot, "backend/services/jobs"),
    resolve(sourceRoot, "backend/repositories/admin"),
    resolve(sourceRoot, "backend/repositories/recruiter"),
    resolve(sourceRoot, "backend/repositories/recruiter-header"),
    resolve(sourceRoot, "app/api/admin"),
    resolve(sourceRoot, "app/api/recruiter"),
    resolve(sourceRoot, "app/api/employer"),
    resolve(sourceRoot, "app/recruiter"),
    resolve(sourceRoot, "frontend/features/employer-verification"),
    ];
    const files = (await Promise.all(roots.map((root) => sourceFiles(root).catch(() => [])))).flat();
    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (/(?:private-cv-match|repositories\/private-cv-match)/u.test(content)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("does not expose private-check discovery terms in employer modules", async () => {
    const roots = [
      resolve(sourceRoot, "backend/admin"),
      resolve(sourceRoot, "backend/recruiter"),
      resolve(sourceRoot, "backend/recruiter-header"),
      resolve(sourceRoot, "backend/applications"),
      resolve(sourceRoot, "backend/services/jobs"),
      resolve(sourceRoot, "backend/repositories/admin"),
      resolve(sourceRoot, "backend/repositories/recruiter"),
      resolve(sourceRoot, "backend/repositories/recruiter-header"),
      resolve(sourceRoot, "app/api/admin"),
      resolve(sourceRoot, "app/api/recruiter"),
      resolve(sourceRoot, "app/api/employer"),
      resolve(sourceRoot, "app/recruiter"),
      resolve(sourceRoot, "frontend/features/employer-verification"),
    ];
    const files = (await Promise.all(roots.map((root) => sourceFiles(root).catch(() => [])))).flat();
    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (/(?:private[-_]cv[-_]match|PrivateCvMatch|pmc_)/iu.test(content)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });

  it("keeps private modules out of employer application relations", async () => {
    const files = await sourceFiles(resolve(sourceRoot, "backend/private-cv-match"));
    const violations: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      if (/jobApplication|JobApplication|companyId|recruiterUserId|rankingSnapshot/iu.test(content)) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
