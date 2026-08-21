import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const { prisma } = await import("../src/backend/database/prisma.ts");
const rows = await prisma.backupRun.findMany({
  orderBy: { requestedAt: "desc" },
  take: 10,
  select: { id: true, trigger: true, status: true, failureCode: true, requestedAt: true, startedAt: true, completedAt: true, byteCount: true, driveFolderId: true, driveFileId: true },
});
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
