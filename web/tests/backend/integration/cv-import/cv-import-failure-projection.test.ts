import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { getCvImportResource } from "@/backend/services/cv-import/cv-import-projection";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];
const now = new Date("2026-08-01T05:00:00.000Z");

afterEach(async () => {
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("CV failure projection", () => {
  it.each([
    ["missing", null],
    ["unknown", "UNREVIEWED_SCANNER_DETAIL"],
  ] as const)(
    "fails closed for a %s terminal failure code",
    async (_label, failureCode) => {
      const client = await pool.connect();
      const seeded = await seedCvRecoveryImport(
        client,
        `projection-${_label}`,
        {
          stage: "SCAN",
          mode: "TERMINAL_FAILURE",
          now,
          automaticAttemptsUsed: 3,
        },
      );
      accounts.push(seeded.accountId);
      await client.query(
        `UPDATE "CvUpload" SET "failureCode" = $2 WHERE "id" = $1`,
        [seeded.uploadId, failureCode],
      );
      client.release();

      const resource = await getCvImportResource(
        seeded.accountId,
        seeded.uploadId,
      );

      expect(resource).toMatchObject({
        status: "SCAN_FAILED",
        failure: {
          code: "CV_PROCESSING_FAILED",
          retryable: false,
          suggestedActions: ["REPLACE_DOCUMENT", "MANUAL_PROFILE", "DELETE"],
        },
      });
      expect(
        "availableActions" in resource && resource.availableActions,
      ).not.toContain("RETRY");
    },
  );
});
