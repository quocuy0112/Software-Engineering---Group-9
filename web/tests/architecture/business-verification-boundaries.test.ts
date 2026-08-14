import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("business verification boundaries", () => {
  it("keeps preparation business rules independent from Prisma and VietQR", async () => {
    const service = await source(
      "src/backend/admin/verification/employer-verification-preparation-service.ts",
    );
    const repository = await source(
      "src/backend/repositories/admin/prisma-employer-verification-preparation-repository.ts",
    );
    const gateway = await source(
      "src/backend/business-registry/business-registry-lookup-gateway.ts",
    );

    expect(service).not.toContain("@/backend/database/prisma");
    expect(service).not.toContain("vietqr-business-registry-adapter");
    expect(repository).toContain("@/backend/database/prisma");
    expect(gateway).not.toContain("vietqr");
  });

  it("keeps candidate components free of server data access", async () => {
    const page = await source(
      "src/frontend/features/employer-verification/employer-verification-page.tsx",
    );

    expect(page).not.toContain("@/backend");
    expect(page).not.toContain("generated/prisma");
  });
});
