import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Feature 009 Group 1 directory boundaries", () => {
  it("uses the qualifying authority classifier and deterministic ordering", () => {
    const repository = source(
      "src/backend/repositories/admin/prisma-account-directory-repository.ts",
    );
    expect(repository).toContain('verificationState: "ACTIVE"');
    expect(repository).toContain('status: "ACTIVE"');
    expect(repository).toContain(
      'orderBy: [{ createdAt: "desc" }, { id: "asc" }]',
    );
    expect(repository).toContain("groupBy");
    expect(repository).not.toContain("session");
  });

  it("preserves unavailable aggregates as an explicit result", () => {
    const service = source(
      "src/backend/admin/accounts/account-directory-service.ts",
    );
    expect(service).toContain("candidateUnavailable");
    expect(service).toContain("recruiterUnavailable");
    expect(service).toContain("calculatedAt");
    expect(service).not.toContain("candidateProfile");
  });

  it("projects approved evidence without exposing storage or encryption fields", () => {
    const repository = source(
      "src/backend/repositories/admin/prisma-account-directory-repository.ts",
    );
    const resources = source("src/shared/contracts/admin/resources.ts");
    expect(repository).toContain('state: "APPROVED"');
    expect(repository).toContain("currentEvidenceId");
    expect(repository).toContain("approvedVerificationEvidence");
    expect(repository).not.toContain("storageLocator");
    expect(repository).not.toContain("authenticationTag");
    expect(resources).toContain("approvedVerificationEvidenceSchema");
  });
});
