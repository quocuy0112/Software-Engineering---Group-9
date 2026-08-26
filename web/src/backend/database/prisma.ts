import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/backend/generated/prisma/client";
import { serverEnvironment } from "@/backend/env/runtime";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg(serverEnvironment.DATABASE_URL);
  return new PrismaClient({
    adapter,
    transactionOptions: {
      // The admin and analytics workers can briefly occupy the pool. Give
      // short recruiter mutations enough time to acquire a connection without
      // changing their transactional behavior.
      maxWait: 5_000,
      timeout: 15_000,
    },
  });
}

export const prisma = globalDatabase.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;

export async function verifyDatabaseConnectivity(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
