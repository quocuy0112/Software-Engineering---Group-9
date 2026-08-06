import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { RetryCvImportService } from "@/backend/services/cv-import/retry-cv-import";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
  type SeededCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];

afterEach(async () => {
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("CV OCR failure recovery", () => {
  it.each([
    ["OCR_UNAVAILABLE", "unavailable"],
    ["OCR_TIMEOUT", "timeout"],
    ["OCR_OUTPUT_INVALID", "invalid"],
    ["OCR_LOW_CONFIDENCE", "low"],
  ] as const)(
    "offers one bounded rescan/extraction retry for %s without mutating Profile",
    async (failureCode, label) => {
      const now = new Date();
      const client = await pool.connect();
      let seeded: SeededCvRecoveryImport;
      try {
        seeded = await seedCvRecoveryImport(client, `ocr-${label}`, {
          stage: "EXTRACTION",
          mode: "TERMINAL_FAILURE",
          now,
        });
        accounts.push(seeded.accountId);
        await client.query(
          `UPDATE "CvUpload" SET "failureCode" = $2
            WHERE "id" = $1 AND "status" = 'EXTRACTION_FAILED'`,
          [seeded.uploadId, failureCode],
        );
      } finally {
        client.release();
      }

      await expect(
        new RetryCvImportService().execute({
          accountId: seeded.accountId,
          uploadId: seeded.uploadId,
          idempotencyKey: `ocr-retry-${failureCode}-0001`,
          now,
        }),
      ).resolves.toMatchObject({
        uploadId: seeded.uploadId,
        status: "SCAN_QUEUED",
        scanRetriesRemaining: 1,
      });
      const evidence = await pool.query<{
        uploadStatus: string;
        failureCode: string | null;
        contentInaccessibleAt: Date | null;
        sourceStatus: string;
        sourceInaccessibleAt: Date | null;
        candidateInitiated: boolean;
        scanStatus: string;
        profileRevision: number;
        drafts: number;
      }>(
        `SELECT upload."status"::text AS "uploadStatus", upload."failureCode",
                upload."contentInaccessibleAt",
                source."status"::text AS "sourceStatus",
                source."contentInaccessibleAt" AS "sourceInaccessibleAt",
                scan."candidateInitiated", scan."status"::text AS "scanStatus",
                profile."revision" AS "profileRevision",
                (SELECT COUNT(*)::int FROM "CvDraft" draft
                  WHERE draft."uploadId" = upload."id") AS "drafts"
           FROM "CvUpload" upload
           JOIN "CvStoredArtifact" source
             ON source."uploadId" = upload."id" AND source."kind" = 'SOURCE_DOCUMENT'
           JOIN "CvScanAssessment" scan ON scan."uploadId" = upload."id"
           JOIN "CandidateProfile" profile ON profile."id" = upload."profileId"
          WHERE upload."id" = $1
          ORDER BY scan."attemptNumber" DESC
          LIMIT 1`,
        [seeded.uploadId],
      );
      expect(evidence.rows[0]).toEqual({
        uploadStatus: "SCAN_QUEUED",
        failureCode: null,
        contentInaccessibleAt: null,
        sourceStatus: "AVAILABLE",
        sourceInaccessibleAt: null,
        candidateInitiated: true,
        scanStatus: "QUEUED",
        profileRevision: 0,
        drafts: 0,
      });
    },
  );

  it("keeps non-OCR extraction corruption on replacement/manual recovery only", async () => {
    const now = new Date();
    const client = await pool.connect();
    const seeded = await seedCvRecoveryImport(client, "non-ocr-no-retry", {
      stage: "EXTRACTION",
      mode: "TERMINAL_FAILURE",
      now,
    });
    accounts.push(seeded.accountId);
    client.release();
    await expect(
      new RetryCvImportService().execute({
        accountId: seeded.accountId,
        uploadId: seeded.uploadId,
        idempotencyKey: "non-ocr-no-retry-0001",
        now,
      }),
    ).rejects.toThrow("IMPORT_STATE_CONFLICT");
  });
});
