import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("recruiter header privacy and host canaries", () => {
  it("keeps the public contract identifier-free", async () => {
    const contract = await source(
      "src/shared/contracts/recruiter-header-status.ts",
    );
    for (const forbidden of [
      "accountId",
      "userId",
      "sessionId",
      "companyId",
      "requestId",
      "normalizedTaxIdentifier",
      "submittedCompanyName",
    ]) {
      expect(contract).not.toContain(forbidden);
    }
  });

  it("keeps feature code read-only and storage-free", async () => {
    const repository = await source(
      "src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts",
    );
    const service = await source(
      "src/backend/recruiter-header/recruiter-header-status-service.ts",
    );
    for (const token of [".create(", ".update(", ".delete(", ".upsert("]) {
      expect(repository).not.toContain(token);
    }
    expect(service).not.toContain("localStorage");
    expect(service).not.toContain("sessionStorage");
  });

  it("keeps route responses no-store and neutral on wrong hosts", async () => {
    const route = await source("src/app/api/recruiter/header-status/route.ts");
    expect(route).toContain("Cache-Control");
    expect(route).toContain("UNAVAILABLE");
    expect(route).toContain("isCandidateRequestHost");
  });
});
