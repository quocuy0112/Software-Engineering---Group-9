import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/backend/generated/prisma/client.ts";
import { config as loadEnvironment } from "dotenv";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { distributeUnassignedPendingReviews } from "../src/backend/jobs/review/job-post-review-assignment.ts";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Usage: revoke-platform-administrator.mjs <email>");
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DIRECT_URL or DATABASE_URL is required in web/.env.local");

const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
try {
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.userAccount.findUnique({
      where: { normalizedEmail: email },
      select: { id: true },
    });
    if (!user) throw new Error(`Account not found: ${email}`);

    const existing = await transaction.platformAdministratorGrant.findUnique({
      where: { userId: user.id },
      include: { sessionPolicy: true },
    });
    if (!existing)
      throw new Error(`Administrator grant not found for: ${email}`);

    const now = new Date();
    const designatedSessionId = existing.sessionPolicy?.designatedSessionId;
    if (designatedSessionId) {
      await transaction.session.updateMany({
        where: {
          id: designatedSessionId,
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: "administrator_grant_revoked",
        },
      });
    }
    if (existing.sessionPolicy) {
      await transaction.administratorSessionPolicy.update({
        where: { grantId: existing.id },
        data: {
          designatedSessionId: null,
          initialTwoFactorAt: null,
          latestTwoFactorProofAt: null,
          designationVersion: { increment: 1 },
        },
      });
    }
    await transaction.authenticationChallenge.deleteMany({
      where: { userId: user.id, consumedAt: null },
    });

    const grant =
      existing.state === "REVOKED"
        ? existing
        : await transaction.platformAdministratorGrant.update({
            where: { id: existing.id },
            data: {
              state: "REVOKED",
              expiresAt: null,
              stateChangedAt: now,
              version: { increment: 1 },
            },
          });

    // Review state belongs to the recruiter submission, not to its assignee.
    // Releasing the revoked administrator's assignments keeps every submitted
    // version pending and lets another active administrator claim it without
    // forcing the recruiter to create a new submission.
    const releasedPendingReviewAssignments =
      await transaction.jobPostReviewVersion.updateMany({
        where: {
          state: "PENDING_REVIEW",
          assignedAdminUserId: user.id,
        },
        data: {
          assignedAdminUserId: null,
          assignedAt: null,
        },
      });
    const reassignedPendingReviews = await distributeUnassignedPendingReviews(
      transaction,
      now,
    );

    await transaction.auditEvent.create({
      data: {
        occurredAt: now,
        actorType: "operator_terminal",
        action: "admin.grant_revoked",
        targetType: "platform_administrator_grant",
        targetId: grant.id,
        result: "SUCCESS",
        correlationId: randomUUID(),
        context: {
          source: "operator_terminal",
          previousState: existing.state,
          changed: existing.state !== "REVOKED",
          designatedSessionRevoked: Boolean(designatedSessionId),
          releasedPendingReviewAssignments:
            releasedPendingReviewAssignments.count,
          reassignedPendingReviews,
        },
      },
    });

    return {
      grantId: grant.id,
      userId: user.id,
      state: grant.state,
      releasedPendingReviewAssignments: releasedPendingReviewAssignments.count,
      reassignedPendingReviews,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
