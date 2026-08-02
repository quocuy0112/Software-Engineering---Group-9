import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { cvConfiguration } from "@/backend/cv/config";
import { PrismaCvConsentRepository } from "@/backend/repositories/cv-import/prisma-cv-consent-repository";
import { cvExternalConsentBinding } from "@/backend/services/cv-import/cv-consent-service";
import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import { CV_EXTERNAL_CONSENT_NOTICE_TEXT } from "@/shared/contracts/cv-import/consent-retention";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
  type SeededCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const now = new Date("2026-08-02T00:00:00.000Z");
const challengeSecret = "synthetic-consent-challenge-secret-32-bytes";
const accounts: string[] = [];

async function seeded(label: string): Promise<SeededCvRecoveryImport> {
  const client = await pool.connect();
  try {
    const fixture = await seedCvRecoveryImport(client, label, {
      stage: "PARSE",
      mode: "TERMINAL_FAILURE",
      parserClass: "EXTERNAL_OPENAI",
      now,
    });
    accounts.push(fixture.accountId);
    return fixture;
  } finally {
    client.release();
  }
}

function binding(fixture: SeededCvRecoveryImport) {
  return cvExternalConsentBinding({
    accountId: fixture.accountId,
    uploadId: fixture.uploadId,
    configuration: cvConfiguration,
  });
}

async function grant(fixture: SeededCvRecoveryImport) {
  const repository = new PrismaCvConsentRepository(challengeSecret);
  const exact = binding(fixture);
  const challenge = await repository.issueChallenge(exact, now);
  const outcome = await repository.grant({
    ...exact,
    challenge,
    occurredAt: now,
  });
  return { repository, exact, challenge, outcome };
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

describe("append-only external CV processing consent", () => {
  it("binds a grant and queued attempt to the exact account/upload/provider/model/purpose/notice/text tuple", async () => {
    const fixture = await seeded("exact-binding");
    const { repository, exact, outcome } = await grant(fixture);
    await expect(
      repository.requireLiveExternalConsent(exact, now),
    ).resolves.toEqual(
      expect.objectContaining({ consentId: outcome.consentEventId }),
    );
    const rows = await pool.query<{
      accountId: string;
      uploadId: string;
      provider: string;
      providerClass: string;
      model: string;
      purposeVersion: string;
      noticeVersion: string;
      consentTextVersion: string;
      jobConsentId: string;
    }>(
      `SELECT consent."accountId", consent."uploadId", consent."provider",
              consent."providerClass"::text AS "providerClass", consent."model",
              consent."purposeVersion", consent."noticeVersion",
              consent."consentTextVersion", job."consentEventId" AS "jobConsentId"
         FROM "CvProcessingConsent" consent
         JOIN "CvParseJob" job ON job."consentEventId" = consent."id"
        WHERE consent."id" = $1`,
      [outcome.consentEventId],
    );
    expect(rows.rows[0]).toEqual({
      accountId: exact.accountId,
      uploadId: exact.uploadId,
      provider: exact.provider,
      providerClass: exact.providerClass,
      model: exact.model,
      purposeVersion: exact.purposeVersion,
      noticeVersion: exact.noticeVersion,
      consentTextVersion: exact.consentTextVersion,
      jobConsentId: outcome.consentEventId,
    });
  });

  it("rejects replayed and tampered challenges without appending evidence", async () => {
    const fixture = await seeded("challenge-replay");
    const { repository, exact, challenge } = await grant(fixture);
    await repository.revoke({
      ...exact,
      occurredAt: new Date(now.getTime() + 1),
    });
    await expect(
      repository.grant({
        ...exact,
        challenge,
        occurredAt: new Date(now.getTime() + 2),
      }),
    ).rejects.toEqual(
      expect.objectContaining({ code: "IMPORT_STATE_CONFLICT" }),
    );
    const fresh = await repository.issueChallenge(
      exact,
      new Date(now.getTime() + 2),
    );
    const tampered = `${fresh.slice(0, -1)}${fresh.endsWith("a") ? "b" : "a"}`;
    await expect(
      repository.grant({
        ...exact,
        challenge: tampered,
        occurredAt: new Date(now.getTime() + 2),
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "CvProcessingConsent" WHERE "uploadId" = $1`,
      [fixture.uploadId],
    );
    expect(count.rows[0]?.count).toBe("2");
  });

  it("uses chronology and a revocation that blocks future dispatch without mutating the grant", async () => {
    const fixture = await seeded("grant-revoke");
    const { repository, exact, outcome } = await grant(fixture);
    const revokedAt = new Date(now.getTime() + 10);
    const revoked = await repository.revoke({
      ...exact,
      occurredAt: revokedAt,
    });
    expect(revoked.consentEventId).not.toBeNull();
    await expect(
      repository.findLiveExternalConsent(exact, revokedAt),
    ).resolves.toBeNull();
    const history = await pool.query<{
      action: string;
      supersedesConsentId: string | null;
    }>(
      `SELECT "action"::text AS action, "supersedesConsentId"
         FROM "CvProcessingConsent" WHERE "uploadId" = $1 ORDER BY "occurredAt", "id"`,
      [fixture.uploadId],
    );
    expect(history.rows).toEqual([
      { action: "GRANTED", supersedesConsentId: null },
      { action: "REVOKED", supersedesConsentId: outcome.consentEventId },
    ]);
    const job = await pool.query<{ status: string; failureCode: string }>(
      `SELECT "status"::text AS status, "failureCode" FROM "CvParseJob"
        WHERE "consentEventId" = $1`,
      [outcome.consentEventId],
    );
    expect(job.rows[0]).toEqual({
      status: "CANCELLED",
      failureCode: "CONSENT_REVOKED",
    });
  });

  it("requires a new grant whenever any exact binding changes", async () => {
    const fixture = await seeded("binding-change");
    const { repository, exact } = await grant(fixture);
    for (const changed of [
      { ...exact, model: `${exact.model}-changed` },
      { ...exact, purposeVersion: `${exact.purposeVersion}-changed` },
      { ...exact, noticeVersion: `${exact.noticeVersion}-changed` },
      { ...exact, consentTextVersion: `${exact.consentTextVersion}-changed` },
      { ...exact, uploadId: `${exact.uploadId}-changed` },
      { ...exact, accountId: `${exact.accountId}-changed` },
    ]) {
      await expect(
        repository.findLiveExternalConsent(changed, now),
      ).resolves.toBeNull();
    }
  });

  it("denies live dispatch after expiry, logical deletion, or account deactivation", async () => {
    const fixture = await seeded("authority-denial");
    const { repository, exact } = await grant(fixture);
    for (const statement of [
      `UPDATE "CvUpload" SET "status" = 'EXPIRED', "contentInaccessibleAt" = $2,
          "deleteAfter" = $2 WHERE "id" = $1`,
      `UPDATE "CvUpload" SET "status" = 'CANCELLED', "contentInaccessibleAt" = $2,
          "deleteAfter" = $2 WHERE "id" = $1`,
      `UPDATE "user" SET "state" = 'SUSPENDED', "stateChangedAt" = $2 WHERE "id" = $1`,
    ]) {
      await pool.query(statement, [
        statement.includes('"user"') ? fixture.accountId : fixture.uploadId,
        now,
      ]);
      await expect(
        repository.findLiveExternalConsent(exact, now),
      ).resolves.toBeNull();
      if (statement.includes("EXPIRED")) {
        await pool.query(
          `UPDATE "CvUpload" SET "status" = 'PARSE_FAILED', "contentInaccessibleAt" = NULL,
             "deleteAfter" = NULL WHERE "id" = $1`,
          [fixture.uploadId],
        );
      }
      if (statement.includes("CANCELLED")) {
        await pool.query(
          `UPDATE "CvUpload" SET "status" = 'PARSE_FAILED', "contentInaccessibleAt" = NULL,
             "deleteAfter" = NULL WHERE "id" = $1`,
          [fixture.uploadId],
        );
      }
    }
  });

  it("is database-enforced append-only", async () => {
    const fixture = await seeded("append-only");
    const { outcome } = await grant(fixture);
    await expect(
      pool.query(
        `UPDATE "CvProcessingConsent" SET "model" = 'mutated' WHERE "id" = $1`,
        [outcome.consentEventId],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      pool.query(`DELETE FROM "CvProcessingConsent" WHERE "id" = $1`, [
        outcome.consentEventId,
      ]),
    ).rejects.toMatchObject({ code: "55000" });
  });

  it("writes only safe allowlisted audit evidence", async () => {
    const fixture = await seeded("safe-audit");
    const { exact, challenge } = await grant(fixture);
    const rows = await pool.query<{ action: string; context: unknown }>(
      `SELECT "action", "context" FROM "AuditEvent"
        WHERE "targetId" IN (SELECT "id" FROM "CvProcessingConsent" WHERE "uploadId" = $1)`,
      [fixture.uploadId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.action).toBe("cv_import.consent_granted");
    expect(rows.rows[0]?.context).toEqual({
      state: "GRANTED",
      parserClass: "EXTERNAL_OPENAI",
      noticeVersion: "cv-processing.v1",
    });
    const serialized = JSON.stringify(rows.rows);
    expect(serialized).not.toContain(CV_EXTERNAL_CONSENT_NOTICE_TEXT);
    expect(serialized).not.toContain(exact.model);
    expect(serialized).not.toContain(exact.provider);
    expect(serialized).not.toContain(exact.purposeVersion);
    expect(serialized).not.toContain(challenge);
  });

  it("maps missing live consent to the stable consent-required failure", async () => {
    const fixture = await seeded("required-error");
    const repository = new PrismaCvConsentRepository(challengeSecret);
    await expect(
      repository.requireLiveExternalConsent(binding(fixture), now),
    ).rejects.toEqual(new CvImportServiceError("CONSENT_REQUIRED"));
  });
});
