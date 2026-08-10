import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/generated/prisma/client.ts";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: provision-platform-administrator.mjs <email>");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
try {
  const user = await prisma.userAccount.findUnique({ where: { normalizedEmail: email } });
  if (!user || user.state !== "ACTIVE" || !user.twoFactorEnabled) throw new Error("Eligible active two-factor account not found");
  const grant = await prisma.platformAdministratorGrant.upsert({
    where: { userId: user.id },
    create: { userId: user.id, state: "ACTIVE" },
    update: { state: "ACTIVE", expiresAt: null, stateChangedAt: new Date(), version: { increment: 1 } },
  });
  console.log(JSON.stringify({ grantId: grant.id, userId: user.id, state: grant.state }));
} finally {
  await prisma.$disconnect();
}
