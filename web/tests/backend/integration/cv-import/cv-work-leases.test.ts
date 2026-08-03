import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaCvWorkRepository } from "@/backend/repositories/cv-import/prisma-cv-work-repository";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accountIds: string[] = [];
const now = new Date("2026-08-01T02:00:00.000Z");

async function seedQueuedParse(client: PoolClient, label: string) {
  const suffix = `${label}-${randomUUID()}`;
  const accountId = `lease-account-${suffix}`;
  const profileId = `lease-profile-${suffix}`;
  const uploadId = `lease-upload-${suffix}`;
  const sourceId = `lease-source-${suffix}`;
  const scanId = `lease-scan-${suffix}`;
  const outputId = `lease-output-${suffix}`;
  const extractionId = `lease-extraction-${suffix}`;
  const parseId = `lease-parse-${suffix}`;
  const email = `${suffix}@example.invalid`;
  accountIds.push(accountId);
  await client.query(
    `INSERT INTO "user" (
       "id", "name", "email", "normalizedEmail", "emailVerified", "state",
       "stateChangedAt", "createdAt", "updatedAt"
     ) VALUES ($1, 'Synthetic Lease Candidate', $2, $2, true, 'ACTIVE', $3, $3, $3)`,
    [accountId, email, now],
  );
  await client.query(
    `INSERT INTO "CandidateIdentity" ("userId", "createdAt", "updatedAt") VALUES ($1, $2, $2)`,
    [accountId, now],
  );
  await client.query(
    `INSERT INTO "CandidateProfile" (
       "id", "candidateUserId", "revision", "createdAt", "updatedAt"
     ) VALUES ($1, $2, 0, $3, $3)`,
    [profileId, accountId, now],
  );
  await client.query(
    `INSERT INTO "CvAccountQuota" (
       "accountId", "reservedBytes", "retainedBytes", "createdAt", "updatedAt"
     ) VALUES ($1, 0, 2, $2, $2)`,
    [accountId, now],
  );
  await client.query(
    `INSERT INTO "CvUpload" (
       "id", "accountId", "profileId", "documentKind", "parserClass", "status",
       "declaredMediaType", "declaredBytes", "actualBytes", "quotaReservationBytes",
       "quotaReservationRemaining", "sourceSha256", "idempotencyDigest",
       "createBindingDigest", "contentReceivedAt", "expiresAt", "createdAt", "updatedAt"
     ) VALUES (
       $1, $2, $3, 'PDF', 'DETERMINISTIC_INTERNAL', 'PARSE_QUEUED',
       'application/pdf', 1, 1, 524289, 0, decode(repeat('33', 32), 'hex'),
       decode(repeat('44', 32), 'hex'), decode(repeat('55', 32), 'hex'), $4::timestamp,
       $4::timestamp + interval '30 days', $4::timestamp, $4::timestamp
     )`,
    [uploadId, accountId, profileId, now],
  );
  await client.query(
    `INSERT INTO "CvStoredArtifact" (
       "id", "uploadId", "accountId", "kind", "status", "storageAdapter",
       "storageLocator", "encryptionKeyVersion", "encryptionIv", "authenticationTag",
       "plaintextBytes", "ciphertextBytes", "plaintextSha256", "availableAt",
       "deleteAttempts", "createdAt", "updatedAt"
     ) VALUES
       ($1, $2, $3, 'SOURCE_DOCUMENT', 'AVAILABLE', 'fixture-v1', $4, 1,
        decode(repeat('66', 12), 'hex'), decode(repeat('77', 16), 'hex'), 1, 1,
        decode(repeat('33', 32), 'hex'), $7, 0, $7, $7),
       ($5, $2, $3, 'EXTRACTED_TEXT', 'AVAILABLE', 'fixture-v1', $6, 1,
        decode(repeat('88', 12), 'hex'), decode(repeat('99', 16), 'hex'), 1, 1,
        decode(repeat('aa', 32), 'hex'), $7, 0, $7, $7)`,
    [
      sourceId,
      uploadId,
      accountId,
      `fixture/${sourceId}`,
      outputId,
      `fixture/${outputId}`,
      now,
    ],
  );
  await client.query(
    `INSERT INTO "CvScanAssessment" (
       "id", "uploadId", "sourceArtifactId", "accountId", "attemptNumber",
       "candidateInitiated", "status", "engineName", "engineVersion",
       "signatureVersion", "signaturePublishedAt", "startedAt", "completedAt", "createdAt"
     ) VALUES ($1, $2, $3, $4, 1, false, 'CLEAN', 'clamav', '1.4.5', 'fixture', $5, $5, $5, $5)`,
    [scanId, uploadId, sourceId, accountId, now],
  );
  await client.query(
    `INSERT INTO "CvExtraction" (
       "id", "uploadId", "sourceArtifactId", "scanAssessmentId", "accountId",
       "outputArtifactId", "attemptNumber", "status", "extractorName",
       "extractorVersion", "rulesVersion", "pageCount", "segmentCount",
       "extractedUtf8Bytes", "startedAt", "completedAt", "createdAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, 1, 'SUCCEEDED', 'fixture', '1', '1', 1, 1, 1, $7, $7, $7)`,
    [extractionId, uploadId, sourceId, scanId, accountId, outputId, now],
  );
  await client.query(
    `INSERT INTO "CvParseJob" (
       "id", "uploadId", "extractionId", "accountId", "attemptNumber", "trigger",
       "status", "parserClass", "provider", "model", "purposeVersion", "inputVersion",
       "instructionVersion", "schemaVersion", "createdAt"
     ) VALUES ($1, $2, $3, $4, 1, 'INITIAL', 'QUEUED', 'DETERMINISTIC_INTERNAL',
       'smarthire', 'deterministic-v1', 'cv-extract-v1', 'cv-segments-v1',
       'cv-extract-v1', 'cv-draft-v1', $5)`,
    [parseId, uploadId, extractionId, accountId, now],
  );
  return { accountId, uploadId, extractionId, parseId };
}

beforeAll(async () => {
  const result = await pool.query<{ table: string | null }>(
    `SELECT to_regclass('public."CvParseJob"')::text AS table`,
  );
  expect(result.rows[0]?.table).toBe('"CvParseJob"');
});

afterEach(async () => {
  const ids = accountIds.splice(0);
  if (ids.length) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT set_config('smarthire.cv_retention_mode', 'on', true)`,
      );
      await client.query(
        `DELETE FROM "CandidateIdentity" WHERE "userId" = ANY($1::text[])`,
        [ids],
      );
      await client.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [
        ids,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
});

afterAll(async () => pool.end());

describe.sequential("durable CV work leases", () => {
  it("uses FOR UPDATE SKIP LOCKED with bounded disjoint claims", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "src/backend/repositories/cv-import/prisma-cv-work-repository.ts",
      ),
      "utf8",
    );
    expect(source).toMatch(/FOR UPDATE SKIP LOCKED/u);
    const client = await pool.connect();
    try {
      for (const label of ["one", "two", "three"])
        await seedQueuedParse(client, label);
    } finally {
      client.release();
    }
    const repository = new PrismaCvWorkRepository();
    const [left, right] = await Promise.all([
      repository.claimStage({
        stage: "PARSE",
        owner: "worker-left",
        now,
        limit: 2,
        leaseMs: 30_000,
      }),
      repository.claimStage({
        stage: "PARSE",
        owner: "worker-right",
        now,
        limit: 2,
        leaseMs: 30_000,
      }),
    ]);
    expect(left.length).toBeLessThanOrEqual(2);
    expect(right.length).toBeLessThanOrEqual(2);
    expect(new Set([...left, ...right].map((claim) => claim.id)).size).toBe(3);
  });

  it("prevents duplicate delivery, rejects lease loss, and recovers after expiry", async () => {
    const client = await pool.connect();
    let seeded: Awaited<ReturnType<typeof seedQueuedParse>>;
    try {
      seeded = await seedQueuedParse(client, "crash");
    } finally {
      client.release();
    }
    const repository = new PrismaCvWorkRepository();
    const claimed = await repository.claimStage({
      stage: "PARSE",
      owner: "worker-crashed",
      now,
      limit: 1,
      leaseMs: 1_000,
    });
    expect(claimed.map((claim) => claim.id)).toEqual([seeded.parseId]);
    expect(
      await repository.claimStage({
        stage: "PARSE",
        owner: "duplicate",
        now,
        limit: 1,
        leaseMs: 1_000,
      }),
    ).toEqual([]);
    expect(
      await repository.finalizeStage({
        stage: "PARSE",
        id: seeded.parseId,
        owner: "wrong-owner",
        status: "SUCCEEDED",
        now,
      }),
    ).toBe(false);
    const recoveredAt = new Date(now.getTime() + 1_001);
    const recovered = await repository.claimStage({
      stage: "PARSE",
      owner: "worker-recovered",
      now: recoveredAt,
      limit: 1,
      leaseMs: 30_000,
    });
    expect(recovered.map((claim) => claim.id)).toEqual([seeded.parseId]);
    expect(
      await repository.finalizeStage({
        stage: "PARSE",
        id: seeded.parseId,
        owner: "worker-crashed",
        status: "FAILED",
        failureCode: "STALE_RESULT",
        now: recoveredAt,
      }),
    ).toBe(false);
  });

  it("releases owned leases on graceful shutdown", async () => {
    const client = await pool.connect();
    try {
      await seedQueuedParse(client, "shutdown-a");
      await seedQueuedParse(client, "shutdown-b");
    } finally {
      client.release();
    }
    const repository = new PrismaCvWorkRepository();
    expect(
      await repository.claimStage({
        stage: "PARSE",
        owner: "worker-shutdown",
        now,
        limit: 2,
        leaseMs: 30_000,
      }),
    ).toHaveLength(2);
    expect(await repository.releaseWorkerLeases("worker-shutdown", now)).toBe(
      2,
    );
    expect(
      await repository.claimStage({
        stage: "PARSE",
        owner: "worker-next",
        now,
        limit: 2,
        leaseMs: 30_000,
      }),
    ).toHaveLength(2);
  });

  it("enforces one active parse per account and database-authoritative retry bounds", async () => {
    const client = await pool.connect();
    let seeded: Awaited<ReturnType<typeof seedQueuedParse>>;
    try {
      seeded = await seedQueuedParse(client, "retry");
      await expect(
        client.query(
          `INSERT INTO "CvParseJob" (
             "id", "uploadId", "extractionId", "accountId", "previousAttemptId",
             "attemptNumber", "trigger", "status", "parserClass", "provider", "model",
             "purposeVersion", "inputVersion", "instructionVersion", "schemaVersion", "createdAt"
           ) SELECT $1, "uploadId", "extractionId", "accountId", "id", 2,
                    'AUTOMATIC_RETRY', 'QUEUED', "parserClass", "provider", "model",
                    "purposeVersion", "inputVersion", "instructionVersion", "schemaVersion", $2
               FROM "CvParseJob" WHERE "id" = $3`,
          [`duplicate-active-${randomUUID()}`, now, seeded.parseId],
        ),
      ).rejects.toMatchObject({ code: "23505" });
    } finally {
      client.release();
    }
    const repository = new PrismaCvWorkRepository();
    const claim = await repository.claimStage({
      stage: "PARSE",
      owner: "worker-retry",
      now,
      limit: 1,
      leaseMs: 30_000,
    });
    expect(claim).toHaveLength(1);
    expect(
      await repository.finalizeStage({
        stage: "PARSE",
        id: seeded.parseId,
        owner: "worker-retry",
        status: "FAILED",
        failureCode: "PARSER_UNAVAILABLE",
        now,
      }),
    ).toBe(true);
    const retry = await repository.scheduleAutomaticParseRetry({
      uploadId: seeded.uploadId,
      priorJobId: seeded.parseId,
      now: new Date(now.getTime() + 5_000),
    });
    expect(retry.attemptNumber).toBe(2);
    const replay = await repository.scheduleAutomaticParseRetry({
      uploadId: seeded.uploadId,
      priorJobId: seeded.parseId,
      now: new Date(now.getTime() + 5_001),
    });
    expect(replay.id).toBe(retry.id);
  });
});
