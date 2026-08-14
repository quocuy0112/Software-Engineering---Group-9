import { describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";

describe("Feature 014 migration shape", () => {
  it("has every additive table and the existing active-request guard", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'EmployerVerificationPreparation',
          'BusinessRegistryLookupSnapshot',
          'CompanyContactEmailChallenge',
          'VerificationBusinessFacts'
        )
    `;
    expect(rows.map((row) => row.table_name).sort()).toEqual([
      "BusinessRegistryLookupSnapshot",
      "CompanyContactEmailChallenge",
      "EmployerVerificationPreparation",
      "VerificationBusinessFacts",
    ]);
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'RecruiterVerificationRequest_active_applicant_tax_key'
    `;
    expect(indexes).toHaveLength(1);
  });
});
