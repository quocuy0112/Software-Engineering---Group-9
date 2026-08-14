import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("../src/backend/database/prisma.ts");
try {
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "applicantUserId", "normalizedTaxIdentifier", count(*)::int AS count
    FROM "RecruiterVerificationRequest"
    WHERE "state" IN ('PENDING_CHECKS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'RESUBMITTED')
    GROUP BY "applicantUserId", "normalizedTaxIdentifier"
    HAVING count(*) > 1
  `);
  const result = {
    activeRequestDuplicateGroups: duplicates.length,
    pass: duplicates.length === 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
