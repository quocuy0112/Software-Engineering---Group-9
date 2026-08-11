import "server-only";
import { prisma } from "@/backend/database/prisma";
import { EvidenceSafetyPipeline } from "@/backend/admin/verification/evidence-safety-pipeline";
import { FilesystemPrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/filesystem";
import { S3PrivateBusinessEvidenceStorage } from "@/backend/storage/business-evidence/s3";
import type { Prisma } from "@/backend/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { buildVerificationOutbox } from "@/backend/admin/notifications/verification-outbox";

function outbox(
  requestId: string,
  userId: string,
  eventKind: "VERIFICATION_DELAYED" | "VERIFICATION_EXPIRED",
  resultingVersion: number,
  now: Date,
) {
  return buildVerificationOutbox({
    requestId,
    userId,
    eventKind,
    resultingState:
      eventKind === "VERIFICATION_EXPIRED" ? "EXPIRED" : "PROCESSING_DELAYED",
    resultingVersion,
    occurredAt: now,
    nextAction:
      eventKind === "VERIFICATION_EXPIRED" ? "SUBMIT_NEW_REQUEST" : "WAIT",
  });
}

async function makeEvidenceInaccessible(
  tx: Prisma.TransactionClient,
  requestId: string,
  now: Date,
) {
  await tx.businessLicenseEvidence.updateMany({
    where: { requestId, contentInaccessibleAt: null },
    data: {
      contentInaccessibleAt: now,
      deleteAfter: new Date(now.getTime() + 24 * 60 * 60_000),
    },
  });
}

export async function runEvidenceSafetyCycle(now = new Date(), limit = 10) {
  const leaseOwner = `evidence:${randomUUID()}`;
  const requests = await prisma.recruiterVerificationRequest.findMany({
    where: { state: "PENDING_CHECKS", currentEvidenceId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
  });
  let processed = 0;
  for (const request of requests) {
    const evidence = await prisma.businessLicenseEvidence.findUnique({
      where: { id: request.currentEvidenceId! },
    });
    if (!evidence || evidence.contentInaccessibleAt) continue;
    const claimed = await prisma.businessLicenseEvidence.updateMany({
      where: {
        id: evidence.id,
        OR: [
          { processingLeaseExpiry: null },
          { processingLeaseExpiry: { lte: now } },
        ],
      },
      data: {
        processingLeaseOwner: leaseOwner,
        processingLeaseExpiry: new Date(now.getTime() + 60_000),
      },
    });
    if (claimed.count !== 1) continue;
    try {
      const adapter =
        evidence.storageAdapter === "s3"
          ? new S3PrivateBusinessEvidenceStorage()
          : new FilesystemPrivateBusinessEvidenceStorage();
      const bytes = await adapter.read(evidence.storageLocator, evidence);
      const result = await new EvidenceSafetyPipeline().inspect(
        bytes,
        evidence.declaredMediaType,
      );
      await prisma.$transaction(async (tx) => {
        await tx.verificationSafetyAttempt.create({
          data: {
            requestId: request.id,
            evidenceId: evidence.id,
            malwareStatus: result.malware,
            typeStatus: result.type,
            structureStatus: result.structure,
            previewStatus: result.preview,
            policyVersions: result.policyVersions,
            safeFailureCode: result.failureCode,
            attemptCount: 1,
            startedAt: now,
            completedAt: now,
          },
        });
        await tx.businessLicenseEvidence.update({
          where: { id: evidence.id },
          data: {
            detectedMediaType: result.detectedMediaType,
            malwareStatus: result.malware,
            typeStatus: result.type,
            structureStatus: result.structure,
            previewStatus: result.preview,
            reviewableAt: result.preview === "PASS" ? now : null,
            processingLeaseOwner: null,
            processingLeaseExpiry: null,
          },
        });
        if (result.preview === "PASS") {
          await tx.recruiterVerificationRequest.updateMany({
            where: {
              id: request.id,
              version: request.version,
              state: "PENDING_CHECKS",
              currentEvidenceId: evidence.id,
            },
            data: { state: "PENDING_REVIEW", version: { increment: 1 } },
          });
        }
      });
      processed += 1;
    } catch {
      // Provider and storage failures remain pending for a later retry/deadline.
    }
  }
  return { claimed: requests.length, processed };
}

export async function runVerificationDeadlineCycle(now = new Date()) {
  const pending = await prisma.recruiterVerificationRequest.findMany({
    where: {
      OR: [
        { state: "PENDING_CHECKS" },
        { state: "PENDING_REVIEW", viewerUnavailableSince: { not: null } },
        { state: "CHANGES_REQUESTED" },
      ],
    },
  });
  let changed = 0;
  for (const row of pending) {
    const age = now.getTime() - row.createdAt.getTime();
    if (row.state === "PENDING_CHECKS" && age >= 24 * 60 * 60_000) {
      await prisma.$transaction(async (tx) => {
        const update = await tx.recruiterVerificationRequest.updateMany({
          where: { id: row.id, version: row.version, state: "PENDING_CHECKS" },
          data: { state: "EXPIRED", expiredAt: now, version: { increment: 1 } },
        });
        if (update.count) {
          await makeEvidenceInaccessible(tx, row.id, now);
          await tx.emailOutbox.upsert({
            where: {
              idempotencyKey: outbox(
                row.id,
                row.applicantUserId,
                "VERIFICATION_EXPIRED",
                row.version + 1,
                now,
              ).idempotencyKey,
            },
            update: {},
            create: outbox(
              row.id,
              row.applicantUserId,
              "VERIFICATION_EXPIRED",
              row.version + 1,
              now,
            ),
          });
        }
      });
      changed += 1;
      continue;
    }
    if (
      row.state === "PENDING_CHECKS" &&
      age >= 15 * 60_000 &&
      !row.delayedAt
    ) {
      await prisma.$transaction(async (tx) => {
        await tx.recruiterVerificationRequest.updateMany({
          where: { id: row.id, state: "PENDING_CHECKS", delayedAt: null },
          data: { delayedAt: now },
        });
        await tx.emailOutbox.upsert({
          where: {
            idempotencyKey: outbox(
              row.id,
              row.applicantUserId,
              "VERIFICATION_DELAYED",
              row.version,
              now,
            ).idempotencyKey,
          },
          update: {},
          create: outbox(
            row.id,
            row.applicantUserId,
            "VERIFICATION_DELAYED",
            row.version,
            now,
          ),
        });
      });
      changed += 1;
    }
    if (row.state === "PENDING_REVIEW" && row.viewerUnavailableSince) {
      const outage = now.getTime() - row.viewerUnavailableSince.getTime();
      if (outage >= 72 * 60 * 60_000) {
        await prisma.$transaction(async (tx) => {
          const update = await tx.recruiterVerificationRequest.updateMany({
            where: {
              id: row.id,
              version: row.version,
              state: "PENDING_REVIEW",
            },
            data: {
              state: "EXPIRED",
              expiredAt: now,
              version: { increment: 1 },
            },
          });
          if (update.count) {
            await makeEvidenceInaccessible(tx, row.id, now);
            await tx.emailOutbox.upsert({
              where: {
                idempotencyKey: outbox(
                  row.id,
                  row.applicantUserId,
                  "VERIFICATION_EXPIRED",
                  row.version + 1,
                  now,
                ).idempotencyKey,
              },
              update: {},
              create: outbox(
                row.id,
                row.applicantUserId,
                "VERIFICATION_EXPIRED",
                row.version + 1,
                now,
              ),
            });
          }
        });
        changed += 1;
      } else if (outage >= 24 * 60 * 60_000 && !row.viewerDelayNotifiedAt) {
        await prisma.$transaction(async (tx) => {
          await tx.recruiterVerificationRequest.update({
            where: { id: row.id },
            data: { viewerDelayNotifiedAt: now },
          });
          await tx.emailOutbox.upsert({
            where: {
              idempotencyKey: outbox(
                row.id,
                row.applicantUserId,
                "VERIFICATION_DELAYED",
                row.version,
                now,
              ).idempotencyKey,
            },
            update: {},
            create: outbox(
              row.id,
              row.applicantUserId,
              "VERIFICATION_DELAYED",
              row.version,
              now,
            ),
          });
        });
        changed += 1;
      } else if (outage >= 15 * 60_000 && !row.viewerEscalatedAt) {
        await prisma.recruiterVerificationRequest.update({
          where: { id: row.id },
          data: { viewerEscalatedAt: now },
        });
        changed += 1;
      }
    }
    if (
      row.state === "CHANGES_REQUESTED" &&
      row.changesRequestedAt &&
      now.getTime() - row.changesRequestedAt.getTime() >= 30 * 86_400_000
    ) {
      await prisma.$transaction(async (tx) => {
        const update = await tx.recruiterVerificationRequest.updateMany({
          where: {
            id: row.id,
            version: row.version,
            state: "CHANGES_REQUESTED",
          },
          data: { state: "EXPIRED", expiredAt: now, version: { increment: 1 } },
        });
        if (update.count) {
          await makeEvidenceInaccessible(tx, row.id, now);
          await tx.emailOutbox.upsert({
            where: {
              idempotencyKey: outbox(
                row.id,
                row.applicantUserId,
                "VERIFICATION_EXPIRED",
                row.version + 1,
                now,
              ).idempotencyKey,
            },
            update: {},
            create: outbox(
              row.id,
              row.applicantUserId,
              "VERIFICATION_EXPIRED",
              row.version + 1,
              now,
            ),
          });
        }
      });
      changed += 1;
    }
  }
  return { scanned: pending.length, changed };
}
