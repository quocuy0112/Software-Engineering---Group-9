import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnvironment } from "@/lib/env/runtime";

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg(serverEnvironment.DATABASE_URL);
  return new PrismaClient({ adapter });
}

export const prisma = globalDatabase.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;

export async function verifyDatabaseConnectivity(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
