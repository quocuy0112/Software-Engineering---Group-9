import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("recruiter header boundaries", () => {
  it("keeps Prisma and presentation dependencies behind their boundaries", async () => {
    const service = await source(
      "src/backend/recruiter-header/recruiter-header-status-service.ts",
    );
    const repository = await source(
      "src/backend/repositories/recruiter-header/prisma-recruiter-header-status-repository.ts",
    );
    const component = await source(
      "src/frontend/features/recruiter-header/components/recruiter-header-action.tsx",
    );
    expect(service).not.toContain("prisma");
    expect(service).not.toContain("frontend");
    expect(repository).toContain("prisma");
    expect(component).not.toContain("@/backend");
  });

  it("orders exact host validation before session access in the route", async () => {
    const route = await source("src/app/api/recruiter/header-status/route.ts");
    expect(route.indexOf("if (!isCandidateRequestHost")).toBeLessThan(
      route.indexOf("const current = await requireSession"),
    );
  });

  it("keeps host predicate free of session and status dependencies", async () => {
    const boundary = await source(
      "src/backend/auth/candidate-host-boundary.ts",
    );
    expect(boundary).not.toContain("requireSession");
    expect(boundary).not.toContain("status-service");
  });
});
