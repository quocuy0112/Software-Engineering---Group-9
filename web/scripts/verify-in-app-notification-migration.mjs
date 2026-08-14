import { config } from "dotenv";

config({ path: new URL("../.env.local", import.meta.url), quiet: true });

const { prisma } = await import("../src/backend/database/prisma.ts");

try {
  const [duplicates, missingConnections, pendingRecruitment, unsafeRows, invalidRetention] =
    await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT "deduplicationKey", count(*)::int AS count
        FROM "InAppNotification"
        GROUP BY "deduplicationKey"
        HAVING count(*) > 1
      `),
      prisma.$queryRawUnsafe(`
        SELECT n."id"
        FROM "ProfessionalConnectionNotification" n
        LEFT JOIN "InAppNotification" i
          ON i."deduplicationKey" = n."deduplicationKey"
        WHERE n."deleteAfter" > CURRENT_TIMESTAMP
          AND i."id" IS NULL
        LIMIT 20
      `),
      prisma.recruitmentNotificationWork.count({
        where: { status: { in: ["PENDING", "PROCESSING", "RETRYABLE"] } },
      }),
      prisma.$queryRawUnsafe(`
        SELECT "id"
        FROM "InAppNotification"
        WHERE COALESCE("href", '') ~* '(token|proof|code)='
           OR "summary" ~* '(protectedToken|protectedProof)'
        LIMIT 20
      `),
      prisma.$queryRawUnsafe(`
        SELECT "id"
        FROM "InAppNotification"
        WHERE "expiresAt" > "createdAt" + INTERVAL '90 days 1 second'
        LIMIT 20
      `),
    ]);
  const result = {
    duplicateDeduplicationKeys: duplicates.length,
    missingLegacyConnectionRows: missingConnections.length,
    pendingRecruitmentWork: pendingRecruitment,
    unsafeNotificationRows: unsafeRows.length,
    invalidRetentionRows: invalidRetention.length,
  };
  const pass = Object.values(result).every((value) => value === 0);
  console.log(JSON.stringify({ ...result, pass }, null, 2));
  if (!pass) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
