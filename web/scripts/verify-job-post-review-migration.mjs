import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });
const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  const [invalidPointers, invalidHashes, invalidStates, missingRecipients] =
    await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT a."id"
        FROM "JobPostReviewAggregate" a
        LEFT JOIN "JobPostReviewVersion" p ON p."id" = a."pendingVersionId"
        LEFT JOIN "JobPostReviewVersion" v ON v."id" = a."approvedVersionId"
        WHERE (a."pendingVersionId" IS NOT NULL AND (p."reviewAggregateId" <> a."id" OR p."state" <> 'PENDING_REVIEW'))
           OR (a."approvedVersionId" IS NOT NULL AND (v."reviewAggregateId" <> a."id" OR v."state" <> 'APPROVED'))
      `),
      prisma.$queryRawUnsafe(`
        SELECT "id" FROM "JobPostReviewVersion"
        WHERE "snapshotSha256" !~ '^[a-f0-9]{64}$'
      `),
      prisma.$queryRawUnsafe(`
        SELECT "id" FROM "JobPostReviewVersion"
        WHERE ("state" = 'PENDING_REVIEW' AND "decidedAt" IS NOT NULL)
           OR ("state" = 'APPROVED' AND "publishedAt" IS NULL)
           OR ("state" = 'REJECTED' AND ("reasonCode" IS NULL OR "publicExplanation" IS NULL))
      `),
      prisma.$queryRawUnsafe(`
        SELECT v."id"
        FROM "JobPostReviewVersion" v
        WHERE v."state" IN ('APPROVED', 'REJECTED')
          AND v."importedBaseline" = false
          AND NOT EXISTS (
            SELECT 1 FROM "InAppNotification" n
            WHERE n."contextType" = 'JOB_POST_REVIEW'
              AND n."contextId" = v."id"
              AND n."kind" IN ('JOB_POST_APPROVED', 'JOB_POST_REJECTED')
          )
      `),
    ]);
  const result = {
    invalidAggregatePointers: invalidPointers.length,
    invalidSnapshotHashes: invalidHashes.length,
    invalidLifecycleRows: invalidStates.length,
    terminalRowsWithoutRecipientNotification: missingRecipients.length,
  };
  const pass = Object.values(result).every((value) => value === 0);
  console.log(JSON.stringify({ ...result, pass }, null, 2));
  if (!pass) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
