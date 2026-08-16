import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaCvQuotaRepository } from "@/backend/repositories/cv-import/prisma-cv-quota-repository";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];
const now = new Date("2026-08-01T05:00:00.000Z");

async function seedCandidate(client: PoolClient, label: string) {
  const suffix = `${label}-${randomUUID()}`;
  const accountId = `quota-account-${suffix}`;
  const profileId = `quota-profile-${suffix}`;
  const email = `${suffix}@example.invalid`;
  accounts.push(accountId);
  await client.query(
    `INSERT INTO "user" ("id", "name", "email", "normalizedEmail", "emailVerified", "state", "stateChangedAt", "createdAt", "updatedAt")
     VALUES ($1, 'Quota Candidate', $2, $2, true, 'ACTIVE', $3, $3, $3)`,
    [accountId, email, now],
  );
  await client.query(
    `INSERT INTO "CandidateIdentity" ("userId", "createdAt", "updatedAt") VALUES ($1, $2, $2)`,
    [accountId, now],
  );
  await client.query(
    `INSERT INTO "CandidateProfile" ("id", "candidateUserId", "revision", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3, $3)`,
    [profileId, accountId, now],
  );
  return { accountId, profileId };
}

const digest = (value: number) => randomBytes(32).fill(value);

beforeAll(async () => {
  expect(
    (await pool.query(`SELECT to_regclass('public."CvAccountQuota"') AS table`))
      .rows[0]?.table,
  ).toBe('"CvAccountQuota"');
});

afterEach(async () => {
  const ids = accounts.splice(0);
  if (!ids.length) return;
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
    await client.query(`DELETE FROM "user" WHERE "id" = ANY($1::text[])`, [
      ids,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("CV admission and quota", () => {
  it("replays only an exact HMAC binding and never reuses a content digest", async () => {
    const client = await pool.connect();
    const candidate = await seedCandidate(client, "replay");
    client.release();
    const repository = new PrismaCvQuotaRepository();
    const input = {
      ...candidate,
      uploadId: `upload-${randomUUID()}`,
      documentKind: "PDF" as const,
      parserClass: "DETERMINISTIC_INTERNAL" as const,
      declaredMediaType: "application/pdf",
      declaredBytes: 100,
      idempotencyDigest: digest(1),
      bindingDigest: digest(2),
      now,
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
    };
    const created = await repository.reserve(input);
    const replay = await repository.reserve({
      ...input,
      uploadId: `upload-${randomUUID()}`,
    });
    expect(replay).toMatchObject({
      uploadId: created.uploadId,
      replayed: true,
    });
    await expect(
      repository.reserve({ ...input, bindingDigest: digest(3) }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("enforces rolling attempts, retained imports, concurrent byte reservation, and once-only settlement", async () => {
    const client = await pool.connect();
    const candidate = await seedCandidate(client, "limits");
    client.release();
    const repository = new PrismaCvQuotaRepository();
    const reserve = (index: number) => {
      const reservationTime = new Date(now.getTime() + index);
      return repository.reserve({
        ...candidate,
        uploadId: `upload-${randomUUID()}`,
        documentKind: "PDF",
        parserClass: "DETERMINISTIC_INTERNAL",
        declaredMediaType: "application/pdf",
        declaredBytes: 100,
        idempotencyDigest: digest(index + 10),
        bindingDigest: digest(index + 30),
        now: reservationTime,
        expiresAt: new Date(reservationTime.getTime() + 30 * 86_400_000),
      });
    };
    const reservations = [];
    for (let index = 0; index < 5; index += 1)
      reservations.push(await reserve(index));
    await expect(reserve(5)).rejects.toMatchObject({
      code: "UPLOAD_RATE_LIMITED",
      retryAfterSeconds: 3600,
    });
    const first = reservations[0];
    await expect(
      repository.settleSource(first.uploadId, 80, now),
    ).resolves.toBe(true);
    await expect(
      repository.settleSource(first.uploadId, 80, now),
    ).resolves.toBe(false);
    await expect(
      repository.releaseRemaining(first.uploadId, now),
    ).resolves.toBe(true);
    await expect(
      repository.releaseRemaining(first.uploadId, now),
    ).resolves.toBe(false);
  });
});
