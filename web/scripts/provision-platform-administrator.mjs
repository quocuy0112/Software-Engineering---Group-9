import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/generated/prisma/client.ts";
import { config as loadEnvironment } from "dotenv";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const email = process.argv[2]?.trim().toLowerCase();
if (!email)
  throw new Error("Usage: provision-platform-administrator.mjs <email>");
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DIRECT_URL or DATABASE_URL is required in web/.env.local");
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
try {
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.userAccount.findUnique({
      where: { normalizedEmail: email },
    });
    if (!user) throw new Error(`Account not found: ${email}`);
    const ineligibleReasons = [
      ...(user.state === "ACTIVE"
        ? []
        : [`account state is ${user.state}, expected ACTIVE`]),
      ...(user.emailVerified ? [] : ["email is not verified"]),
      ...(user.twoFactorEnabled
        ? []
        : ["two-factor authentication is not enabled"]),
    ];
    if (ineligibleReasons.length)
      throw new Error(
        `Account is not eligible: ${ineligibleReasons.join("; ")}`,
      );

    const existing = await transaction.platformAdministratorGrant.findUnique({
      where: { userId: user.id },
      include: { sessionPolicy: true },
    });
    const reactivating = Boolean(existing && existing.state !== "ACTIVE");
    const now = new Date();

    if (reactivating && existing?.sessionPolicy) {
      if (existing.sessionPolicy.designatedSessionId) {
        await transaction.session.updateMany({
          where: {
            id: existing.sessionPolicy.designatedSessionId,
            userId: user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revocationReason: "administrator_grant_reprovisioned",
          },
        });
      }
      await transaction.administratorSessionPolicy.update({
        where: { grantId: existing.id },
        data: {
          designatedSessionId: null,
          initialTwoFactorAt: null,
          latestTwoFactorProofAt: null,
          designationVersion: { increment: 1 },
        },
      });
      await transaction.authenticationChallenge.deleteMany({
        where: { userId: user.id, consumedAt: null },
      });
    }

    const grant = existing
      ? existing.state === "ACTIVE" && existing.expiresAt === null
        ? existing
        : await transaction.platformAdministratorGrant.update({
            where: { id: existing.id },
            data: {
              state: "ACTIVE",
              expiresAt: null,
              stateChangedAt: now,
              version: { increment: 1 },
            },
          })
      : await transaction.platformAdministratorGrant.create({
          data: { userId: user.id, state: "ACTIVE" },
        });

    await transaction.auditEvent.create({
      data: {
        occurredAt: now,
        actorType: "operator_terminal",
        action: "admin.grant_provisioned",
        targetType: "platform_administrator_grant",
        targetId: grant.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: {
          source: "operator_terminal",
          previousState: existing?.state ?? null,
          changed: !existing || reactivating || existing.expiresAt !== null,
        },
      },
    });

    return { grantId: grant.id, userId: user.id, state: grant.state };
  });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
