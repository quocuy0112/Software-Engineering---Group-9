import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });
const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  const [invalidManagedState, duplicateOpenRequests, invalidFeatures] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT a."id" FROM "JobPostReviewAggregate" a WHERE a."approvedVersionId" IS NOT NULL AND a."publicJobPostingId" IS NOT NULL AND a."visibilityState" IS NULL`),
    prisma.$queryRawUnsafe(`SELECT "aggregateId" FROM "JobPostRevisionRequest" WHERE "state" = 'OPEN' GROUP BY "aggregateId" HAVING COUNT(*) > 1`),
    prisma.$queryRawUnsafe(`SELECT "id" FROM "JobPostFeaturedPlacement" WHERE "startsAt" >= "endsAt"`),
  ]);
  const result = { invalidManagedState: invalidManagedState.length, duplicateOpenRequests: duplicateOpenRequests.length, invalidFeatures: invalidFeatures.length };
  const pass = Object.values(result).every((value) => value === 0);
  process.stdout.write(`${JSON.stringify({ ...result, pass }, null, 2)}\n`);
  if (!pass) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
