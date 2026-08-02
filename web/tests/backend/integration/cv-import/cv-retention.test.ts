import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CvCleanupCoordinator } from "@/backend/cv/workers/cleanup";
import { PrismaCvWorkRepository } from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import { CvRetentionService } from "@/backend/services/cv-import/cv-retention-service";
import { ControlledClock } from "@/backend/time/clock";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
  type SeededCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const initial = new Date("2026-08-02T00:00:00.000Z");
const accounts: string[] = [];

async function seed(
  label: string,
  mode: "PROCESSING" | "TERMINAL_FAILURE" = "TERMINAL_FAILURE",
) {
  const client = await pool.connect();
  try {
    const fixture = await seedCvRecoveryImport(client, label, {
      stage: "PARSE",
      mode,
      now: initial,
    });
    accounts.push(fixture.accountId);
    return fixture;
  } finally {
    client.release();
  }
}

async function addDraft(fixture: SeededCvRecoveryImport) {
  const id = `retention-draft-${randomUUID()}`;
  const upload = await pool.query<{ expiresAt: Date }>(
    `SELECT "expiresAt" FROM "CvUpload" WHERE "id" = $1`,
    [fixture.uploadId],
  );
  await pool.query(
    `INSERT INTO "CvDraft" (
       "id", "uploadId", "accountId", "profileId", "parseJobId", "status",
       "schemaVersion", "revision", "sourceProfileRevision", "reviewedProfileRevision",
       "proposalPayload", "reviewPayload", "provenancePayload", "payloadBytes",
       "provenanceBytes", "expiresAt", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, 'EDITABLE', 'cv-draft-v1', 0, 0, 0,
       '{}'::jsonb, NULL, '{}'::jsonb, 2, 2, $6, $7, $7)`,
    [
      id,
      fixture.uploadId,
      fixture.accountId,
      fixture.profileId,
      fixture.parseId,
      upload.rows[0]?.expiresAt,
      initial,
    ],
  );
  return id;
}

async function physicallyDeleteDue(now: Date) {
  const repository = new PrismaCvWorkRepository();
  const claims = await repository.claimStage({
    stage: "DELETE",
    owner: "retention-delete-worker",
    now,
    limit: 10,
    leaseMs: 90_000,
  });
  for (const claim of claims) {
    expect(
      await repository.finalizeStage({
        stage: "DELETE",
        id: claim.id,
        owner: claim.leaseOwner,
        status: "DELETED",
        now: new Date(now.getTime() + 1),
      }),
    ).toBe(true);
  }
  return claims;
}

beforeAll(async () => {
  await pool.query("SELECT 1");
});

afterEach(async () => {
  if (!accounts.length) return;
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.end();
});

describe("CV import retention lifecycle with a controlled clock", () => {
  it("cancels and denies candidate-deleted content immediately, then becomes DELETED only after object and payload purge", async () => {
    const fixture = await seed("candidate-delete");
    const draftId = await addDraft(fixture);
    const clock = new ControlledClock(initial);
    const retention = new CvRetentionService(clock);
    const first = await retention.deleteOwnedImport({
      accountId: fixture.accountId,
      uploadId: fixture.uploadId,
    });
    expect(first).toMatchObject({
      status: "CANCELLED",
      contentInaccessibleAt: initial.toISOString(),
      deletedAt: null,
    });
    expect(new Date(first.deleteAfter).getTime() - initial.getTime()).toBe(
      24 * 60 * 60_000,
    );
    await expect(
      retention.deleteOwnedImport({
        accountId: fixture.accountId,
        uploadId: fixture.uploadId,
      }),
    ).resolves.toEqual(first);

    const immediate = await pool.query<{
      status: string;
      inaccessible: Date;
      remaining: number;
      activeWork: string;
      pendingArtifacts: string;
      draftStatus: string;
    }>(
      `SELECT upload."status"::text AS status,
              upload."contentInaccessibleAt" AS inaccessible,
              upload."quotaReservationRemaining" AS remaining,
              (SELECT COUNT(*)::text FROM "CvParseJob" job
                WHERE job."uploadId" = upload."id" AND job."status" IN ('QUEUED','PROCESSING')) AS "activeWork",
              (SELECT COUNT(*)::text FROM "CvStoredArtifact" artifact
                WHERE artifact."uploadId" = upload."id" AND artifact."status" = 'DELETE_PENDING') AS "pendingArtifacts",
              (SELECT draft."status"::text FROM "CvDraft" draft
                WHERE draft."uploadId" = upload."id") AS "draftStatus"
         FROM "CvUpload" upload WHERE upload."id" = $1`,
      [fixture.uploadId],
    );
    expect(immediate.rows[0]).toMatchObject({
      status: "CANCELLED",
      remaining: 0,
      activeWork: "0",
      pendingArtifacts: "2",
      draftStatus: "DELETED",
    });

    const beforeDeadline = new Date(new Date(first.deleteAfter).getTime() - 1);
    expect(await physicallyDeleteDue(beforeDeadline)).toHaveLength(0);
    clock.set(first.deleteAfter);
    const cleanup = new CvCleanupCoordinator(clock);
    await cleanup.runOnce();
    expect(await physicallyDeleteDue(clock.now())).toHaveLength(2);
    await cleanup.runOnce({ now: new Date(clock.now().getTime() + 2) });

    const purged = await pool.query<{
      status: string;
      deletedAt: Date;
      filename: string | null;
      sourceSha: Buffer | null;
      retainedBytes: number;
      proposal: unknown;
      provenance: unknown;
      payloadDeletedAt: Date;
      unsafeArtifactMetadata: string;
    }>(
      `SELECT upload."status"::text AS status, upload."deletedAt", 
              upload."displayFilenameCiphertext" AS filename,
              upload."sourceSha256" AS "sourceSha", quota."retainedBytes",
              draft."proposalPayload" AS proposal, draft."provenancePayload" AS provenance,
              draft."payloadDeletedAt",
              (SELECT COUNT(*)::text FROM "CvStoredArtifact" artifact
                WHERE artifact."uploadId" = upload."id"
                  AND (artifact."plaintextBytes" <> 0 OR
                       encode(artifact."plaintextSha256", 'hex') <> repeat('00', 32) OR
                       artifact."storageLocator" NOT LIKE 'deleted_%')) AS "unsafeArtifactMetadata"
         FROM "CvUpload" upload
         JOIN "CvAccountQuota" quota ON quota."accountId" = upload."accountId"
         JOIN "CvDraft" draft ON draft."id" = $2
        WHERE upload."id" = $1`,
      [fixture.uploadId, draftId],
    );
    expect(purged.rows[0]).toMatchObject({
      status: "DELETED",
      filename: null,
      sourceSha: null,
      retainedBytes: 0,
      proposal: null,
      provenance: null,
      unsafeArtifactMetadata: "0",
    });
    expect(purged.rows[0]?.deletedAt).toBeInstanceOf(Date);
    expect(purged.rows[0]?.payloadDeletedAt).toBeInstanceOf(Date);

    await cleanup.runOnce({ now: new Date(clock.now().getTime() + 3) });
    const exactlyOnce = await pool.query<{
      retainedBytes: number;
      audits: string;
    }>(
      `SELECT quota."retainedBytes",
              (SELECT COUNT(*)::text FROM "AuditEvent" audit
                WHERE audit."id" = $2) AS audits
         FROM "CvAccountQuota" quota WHERE quota."accountId" = $1`,
      [fixture.accountId, `cv_cleanup_${fixture.uploadId}`.slice(0, 80)],
    );
    expect(exactlyOnce.rows[0]).toEqual({ retainedBytes: 0, audits: "1" });
  });

  it("expires an unconfirmed import at exactly its 30-day expiresAt without candidate DELETE and eventually scrubs it", async () => {
    const fixture = await seed("natural-expiry", "PROCESSING");
    await addDraft(fixture);
    const deadline = await pool.query<{ expiresAt: Date }>(
      `SELECT "expiresAt" FROM "CvUpload" WHERE "id" = $1`,
      [fixture.uploadId],
    );
    const clock = new ControlledClock(deadline.rows[0]?.expiresAt ?? initial);
    const cleanup = new CvCleanupCoordinator(clock);
    const first = await cleanup.runOnce();
    expect(first.expired).toBe(1);
    const expired = await pool.query<{
      status: string;
      failureCode: string;
      inaccessible: Date;
      activeWork: string;
    }>(
      `SELECT upload."status"::text AS status, upload."failureCode",
              upload."contentInaccessibleAt" AS inaccessible,
              (SELECT COUNT(*)::text FROM "CvParseJob" job WHERE job."uploadId" = upload."id"
                AND job."status" IN ('QUEUED','PROCESSING')) AS "activeWork"
         FROM "CvUpload" upload WHERE upload."id" = $1`,
      [fixture.uploadId],
    );
    expect(expired.rows[0]).toMatchObject({
      status: "EXPIRED",
      failureCode: "IMPORT_EXPIRED",
      activeWork: "0",
    });
    expect(expired.rows[0]?.inaccessible).toBeInstanceOf(Date);
    expect(await physicallyDeleteDue(clock.now())).toHaveLength(2);
    await cleanup.runOnce({ now: new Date(clock.now().getTime() + 2) });
    const final = await pool.query<{
      status: string;
      deletedAt: Date;
      attempts: string;
    }>(
      `SELECT upload."status"::text AS status, upload."deletedAt",
              (SELECT COUNT(*)::text FROM "CvParseJob" job WHERE job."uploadId" = upload."id") AS attempts
         FROM "CvUpload" upload WHERE upload."id" = $1`,
      [fixture.uploadId],
    );
    expect(final.rows[0]).toMatchObject({ status: "EXPIRED", attempts: "1" });
    expect(final.rows[0]?.deletedAt).toBeInstanceOf(Date);
  });

  it("enforces 24-hour incomplete/rejected deadlines and never claims provider deletion early", async () => {
    const fixture = await seed("deadline-24h");
    await pool.query(
      `UPDATE "CvUpload" SET "status" = 'INFECTED', "failureCode" = 'MALWARE_DETECTED',
         "contentInaccessibleAt" = $2, "deleteAfter" = $3 WHERE "id" = $1`,
      [
        fixture.uploadId,
        initial,
        new Date(initial.getTime() + 24 * 60 * 60_000),
      ],
    );
    await pool.query(
      `UPDATE "CvStoredArtifact" SET "status" = 'DELETE_PENDING',
         "contentInaccessibleAt" = $2, "deleteAfter" = $3 WHERE "uploadId" = $1`,
      [
        fixture.uploadId,
        initial,
        new Date(initial.getTime() + 24 * 60 * 60_000),
      ],
    );
    expect(
      await physicallyDeleteDue(
        new Date(initial.getTime() + 24 * 60 * 60_000 - 1),
      ),
    ).toHaveLength(0);
    expect(
      await physicallyDeleteDue(new Date(initial.getTime() + 24 * 60 * 60_000)),
    ).toHaveLength(2);

    const abandoned = await seed("incomplete-24h");
    await pool.query(
      `UPDATE "CvUpload" SET "status" = 'AWAITING_CONTENT', "actualBytes" = NULL,
         "sourceSha256" = NULL, "contentReceivedAt" = NULL,
         "contentInaccessibleAt" = NULL, "deleteAfter" = NULL WHERE "id" = $1`,
      [abandoned.uploadId],
    );
    const clock = new ControlledClock(
      new Date(initial.getTime() + 24 * 60 * 60_000),
    );
    const result = await new CvCleanupCoordinator(clock).runOnce();
    expect(result.abandoned).toBe(1);
    const state = await pool.query<{ status: string; deleteAfter: Date }>(
      `SELECT "status"::text AS status, "deleteAfter" FROM "CvUpload" WHERE "id" = $1`,
      [abandoned.uploadId],
    );
    expect(state.rows[0]?.status).toBe("VALIDATION_FAILED");
    expect(state.rows[0]?.deleteAfter.getTime()).toBe(clock.now().getTime());
  });

  it("activates unconfirmed 30-day and confirmed seven-day source/draft deadlines", async () => {
    const unconfirmed = await seed("unconfirmed-30d");
    const unconfirmedDeadline = await pool.query<{ expiresAt: Date }>(
      `SELECT "expiresAt" FROM "CvUpload" WHERE "id" = $1`,
      [unconfirmed.uploadId],
    );
    const clock30 = new ControlledClock(
      unconfirmedDeadline.rows[0]?.expiresAt ?? initial,
    );
    const cleanup30 = new CvCleanupCoordinator(clock30);
    expect((await cleanup30.runOnce()).expired).toBe(1);
    await physicallyDeleteDue(clock30.now());
    await cleanup30.runOnce({ now: new Date(clock30.now().getTime() + 2) });

    const confirmed = await seed("confirmed-7d");
    await addDraft(confirmed);
    const sevenDays = new Date(initial.getTime() + 7 * 24 * 60 * 60_000);
    await pool.query(
      `UPDATE "CvUpload" SET "status" = 'CONFIRMED', "confirmedAt" = $2,
         "contentInaccessibleAt" = $2, "deleteAfter" = $3 WHERE "id" = $1`,
      [confirmed.uploadId, initial, sevenDays],
    );
    await pool.query(
      `UPDATE "CvDraft" SET "status" = 'CONFIRMED', "confirmedAt" = $2,
         "contentInaccessibleAt" = $2, "payloadDeleteAfter" = $3 WHERE "uploadId" = $1`,
      [confirmed.uploadId, initial, sevenDays],
    );
    await pool.query(
      `UPDATE "CvStoredArtifact" SET "contentInaccessibleAt" = $2,
         "deleteAfter" = $3 WHERE "uploadId" = $1`,
      [confirmed.uploadId, initial, sevenDays],
    );
    const before = new ControlledClock(new Date(sevenDays.getTime() - 1));
    await new CvCleanupCoordinator(before).runOnce();
    expect(await physicallyDeleteDue(before.now())).toHaveLength(0);
    const atDeadline = new ControlledClock(sevenDays);
    const result = await new CvCleanupCoordinator(atDeadline).runOnce();
    expect(result.draftsScrubbed).toBe(1);
    expect(result.artifactsScheduled).toBe(2);
    expect(await physicallyDeleteDue(sevenDays)).toHaveLength(2);
  });
});
