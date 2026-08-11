import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("recruiter header repository projection boundary", () => {
  it("uses account-scoped existence and deterministic latest ordering", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts",
      ),
      "utf8",
    );
    expect(source).toContain("where: { applicantUserId: userId }");
    expect(source).toContain("orderBy: [{ createdAt:");
    expect(source).toContain("select: { state: true }");
    expect(source).toContain("status:");
    expect(source).toContain("verificationState:");
  });
});
