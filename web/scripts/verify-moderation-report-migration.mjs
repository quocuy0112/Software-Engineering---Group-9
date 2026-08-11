import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("../src/backend/database/prisma.ts");
try {
  const [legacy, generalized] = await Promise.all([
    prisma.jobReport.count(),
    prisma.moderationReport.count({ where: { targetType: "JOB" } }),
  ]);
  const missing = await prisma.$queryRawUnsafe(
    'SELECT count(*)::int AS count FROM "JobReport" j LEFT JOIN "ModerationReport" m ON m."targetType" = \'JOB\' AND m."targetReference" = j."jobPostingId" AND m."reporterUserId" = j."reporterUserId" WHERE m.id IS NULL',
  );
  const missingCount = Number(missing[0]?.count ?? 0);
  const result = {
    legacy,
    generalized,
    missing: missingCount,
    pass: missingCount === 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
