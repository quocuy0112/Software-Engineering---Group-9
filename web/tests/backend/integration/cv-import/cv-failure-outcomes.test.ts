import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  CV_APPROVED_OPENAI_ENDPOINT,
  CV_APPROVED_OPENAI_MODEL,
  cvConfiguration,
  type CvConfiguration,
} from "@/backend/cv/config";
import { ExtractionStageProcessor } from "@/backend/cv/workers/extraction-stage";
import { ParseStageProcessor } from "@/backend/cv/workers/parse-stage";
import { ScanStageProcessor } from "@/backend/cv/workers/scan-stage";
import { PrismaCvWorkRepository } from "@/backend/repositories/cv-import/prisma-cv-work-repository";
import {
  cleanupCvRecoveryAccounts,
  grantExactRecoveryConsent,
  seedCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accounts: string[] = [];
const now = new Date("2026-08-01T04:00:00.000Z");
const signal = new AbortController().signal;

function approvedExternalConfiguration(): CvConfiguration {
  return {
    ...cvConfiguration,
    parser: {
      adapter: "openai",
      endpoint: CV_APPROVED_OPENAI_ENDPOINT,
      model: CV_APPROVED_OPENAI_MODEL,
      enabled: true,
      apiKey: "synthetic-approved-key",
      privacyApproved: true,
    },
  };
}

function verifiedPdf() {
  return {
    plaintextBytes: 1,
    sha256: "fixture",
    open: async function* () {
      yield Buffer.from("%PDF-1.7\n", "latin1");
    },
    dispose: vi.fn(async () => undefined),
  };
}

async function uploadState(uploadId: string) {
  const result = await pool.query<{
    status: string;
    failureCode: string | null;
    contentInaccessibleAt: Date | null;
    deleteAfter: Date | null;
  }>(
    `SELECT "status"::text, "failureCode", "contentInaccessibleAt", "deleteAfter"
       FROM "CvUpload" WHERE "id" = $1`,
    [uploadId],
  );
  return result.rows[0];
}

afterEach(async () => {
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accounts.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("CV terminal failure outcomes", () => {
  it("classifies infected input, blocks downstream work, and schedules every retained byte within 24 hours", async () => {
    const client = await pool.connect();
    const seeded = await seedCvRecoveryImport(client, "infected", {
      stage: "SCAN",
      now,
    });
    accounts.push(seeded.accountId);
    client.release();
    const scanner = {
      scan: vi.fn(async () => ({
        outcome: "INFECTED" as const,
        threatCode: "MALWARE_DETECTED" as const,
      })),
      assessmentMetadata: () => ({
        engineVersion: "1.4.5",
        signatureVersion: "fixture",
        publishedAt: now,
      }),
    };
    const processor = new ScanStageProcessor({
      storage: { assertReady: vi.fn(async () => undefined) },
      reader: { verify: vi.fn(async () => verifiedPdf()) },
      scanner,
    } as never);
    const outcome = await processor.process(
      {
        id: seeded.scanId,
        uploadId: seeded.uploadId,
        accountId: seeded.accountId,
        attemptNumber: 1,
        leaseOwner: seeded.leaseOwner,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      },
      { signal, now },
    );
    expect(outcome).toEqual({
      status: "INFECTED",
      failureCode: "MALWARE_DETECTED",
    });
    expect(await uploadState(seeded.uploadId)).toMatchObject({
      status: "INFECTED",
      failureCode: "MALWARE_DETECTED",
      contentInaccessibleAt: now,
    });
    const state = await pool.query<{
      status: string;
      contentInaccessibleAt: Date | null;
      deleteAfter: Date | null;
      downstream: number;
    }>(
      `SELECT artifact."status"::text, artifact."contentInaccessibleAt", artifact."deleteAfter",
              (SELECT count(*)::int FROM "CvExtraction" WHERE "uploadId" = $1) AS downstream
         FROM "CvStoredArtifact" artifact WHERE artifact."id" = $2`,
      [seeded.uploadId, seeded.sourceId],
    );
    expect(state.rows[0]).toMatchObject({
      status: "DELETE_PENDING",
      contentInaccessibleAt: now,
      downstream: 0,
    });
    expect(state.rows[0]!.deleteAfter?.getTime()).toBe(
      now.getTime() + 24 * 60 * 60_000,
    );
  });

  it.each([
    ["scanner unavailable", "CV_SCANNER_UNAVAILABLE", "SCANNER_UNAVAILABLE"],
    [
      "stale scanner definitions",
      "CV_SCANNER_DEFINITIONS_STALE",
      "SCANNER_DEFINITIONS_STALE",
    ],
  ])(
    "persists %s without leaking a daemon error or creating downstream work",
    async (_label, rawCode, expectedCode) => {
      const client = await pool.connect();
      const seeded = await seedCvRecoveryImport(
        client,
        `scan-${expectedCode}`,
        {
          stage: "SCAN",
          now,
        },
      );
      accounts.push(seeded.accountId);
      client.release();
      const processor = new ScanStageProcessor({
        storage: { assertReady: vi.fn(async () => undefined) },
        reader: { verify: vi.fn(async () => verifiedPdf()) },
        scanner: {
          scan: vi.fn(async () => {
            throw Object.assign(new Error("private daemon detail"), {
              code: rawCode,
            });
          }),
          assessmentMetadata: () => null,
        },
      } as never);
      await expect(
        processor.process(
          {
            id: seeded.scanId,
            uploadId: seeded.uploadId,
            accountId: seeded.accountId,
            attemptNumber: 1,
            leaseOwner: seeded.leaseOwner,
            leaseExpiresAt: new Date(now.getTime() + 60_000),
          },
          { signal, now },
        ),
      ).resolves.toEqual({
        status: "INDETERMINATE",
        failureCode: expectedCode,
      });
      expect(await uploadState(seeded.uploadId)).toMatchObject({
        status: "SCAN_FAILED",
        failureCode: expectedCode,
        contentInaccessibleAt: null,
        deleteAfter: null,
      });
      const downstream = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "CvExtraction" WHERE "uploadId" = $1`,
        [seeded.uploadId],
      );
      expect(downstream.rows[0]?.count).toBe(0);
    },
  );

  it("turns a source integrity failure into an inaccessible cleanup-bound terminal state", async () => {
    const client = await pool.connect();
    const seeded = await seedCvRecoveryImport(client, "integrity", {
      stage: "SCAN",
      now,
    });
    accounts.push(seeded.accountId);
    client.release();
    const processor = new ScanStageProcessor({
      storage: { assertReady: vi.fn(async () => undefined) },
      reader: {
        verify: vi.fn(async () => {
          throw Object.assign(new Error("ciphertext mismatch"), {
            code: "ARTIFACT_INTEGRITY_FAILED",
          });
        }),
      },
      scanner: { scan: vi.fn(), assessmentMetadata: () => null },
    } as never);
    await expect(
      processor.process(
        {
          id: seeded.scanId,
          uploadId: seeded.uploadId,
          accountId: seeded.accountId,
          attemptNumber: 1,
          leaseOwner: seeded.leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
        { signal, now },
      ),
    ).resolves.toEqual({
      status: "INDETERMINATE",
      failureCode: "ARTIFACT_INTEGRITY_FAILED",
    });
    expect(await uploadState(seeded.uploadId)).toMatchObject({
      status: "VALIDATION_FAILED",
      failureCode: "ARTIFACT_INTEGRITY_FAILED",
      contentInaccessibleAt: now,
    });
    const artifact = await pool.query<{
      status: string;
      deleteAfter: Date | null;
    }>(
      `SELECT "status"::text, "deleteAfter" FROM "CvStoredArtifact" WHERE "id" = $1`,
      [seeded.sourceId],
    );
    expect(artifact.rows[0]?.status).toBe("DELETE_PENDING");
    expect(artifact.rows[0]?.deleteAfter?.getTime()).toBeLessThanOrEqual(
      now.getTime() + 24 * 60 * 60_000,
    );
  });

  it.each([
    ["encrypted PDF", "ENCRYPTED", "DOCUMENT_ENCRYPTED"],
    ["active PDF/DOCX", "ACTIVE_CONTENT", "DOCUMENT_ACTIVE_CONTENT"],
    ["oversize structure", "OUTPUT_LIMIT", "DOCUMENT_LIMIT_EXCEEDED"],
    ["empty/image-only document", "EMPTY_TEXT", "EXTRACTION_EMPTY"],
    ["extractor timeout", "EXTRACTION_TIMEOUT", "EXTRACTION_TIMEOUT"],
    ["extractor crash", "PROCESS_CRASH", "EXTRACTION_FAILED"],
  ])(
    "classifies %s atomically and cleans every partial extraction",
    async (_label, rawCode, expectedCode) => {
      const client = await pool.connect();
      const seeded = await seedCvRecoveryImport(
        client,
        `extract-${expectedCode}`,
        { stage: "EXTRACTION", now },
      );
      accounts.push(seeded.accountId);
      client.release();
      const segments = { writeEncrypted: vi.fn() };
      const processor = new ExtractionStageProcessor({
        storage: { assertReady: vi.fn(async () => undefined) },
        reader: { verify: vi.fn(async () => verifiedPdf()) },
        extractor: {
          extract: vi.fn(async () => {
            throw Object.assign(new Error("private extractor detail"), {
              code: rawCode,
            });
          }),
        },
        segments,
      } as never);
      const outcome = await processor.process(
        {
          id: seeded.extractionId!,
          uploadId: seeded.uploadId,
          accountId: seeded.accountId,
          attemptNumber: 1,
          leaseOwner: seeded.leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
        { signal, now },
      );
      expect(outcome).toEqual({ status: "FAILED", failureCode: expectedCode });
      expect(segments.writeEncrypted).not.toHaveBeenCalled();
      expect(
        await new PrismaCvWorkRepository().finalizeStage({
          stage: "EXTRACTION",
          id: seeded.extractionId!,
          owner: seeded.leaseOwner,
          status: "FAILED",
          failureCode: expectedCode,
          now,
        }),
      ).toBe(true);
      expect(await uploadState(seeded.uploadId)).toMatchObject({
        status: "EXTRACTION_FAILED",
        failureCode: expectedCode,
        contentInaccessibleAt: now,
      });
      const partials = await pool.query<{ outputs: number; drafts: number }>(
        `SELECT
         (SELECT count(*)::int FROM "CvStoredArtifact" WHERE "uploadId" = $1 AND "kind" = 'EXTRACTED_TEXT') AS outputs,
         (SELECT count(*)::int FROM "CvDraft" WHERE "uploadId" = $1) AS drafts`,
        [seeded.uploadId],
      );
      expect(partials.rows[0]).toEqual({ outputs: 0, drafts: 0 });
    },
  );

  it.each([
    ["parser timeout", "PARSER_TIMEOUT", "parser"],
    ["provider unavailable", "PARSER_UNAVAILABLE", "parser"],
    ["invalid parser output", "PARSER_OUTPUT_INVALID", "draft"],
    ["oversize parser output", "PARSER_OUTPUT_LIMIT_EXCEEDED", "draft"],
  ])(
    "persists %s with no draft or partial artifact",
    async (_label, expectedCode, failureAt) => {
      const client = await pool.connect();
      const seeded = await seedCvRecoveryImport(
        client,
        `parse-${expectedCode}`,
        { stage: "PARSE", now },
      );
      accounts.push(seeded.accountId);
      client.release();
      const parser = {
        parserClass: "DETERMINISTIC_INTERNAL" as const,
        parse: vi.fn(async () => {
          if (failureAt === "parser") throw new Error(expectedCode);
          return { output: {}, dispatch: {} };
        }),
      };
      const drafts = {
        execute: vi.fn(async () => {
          throw new Error(expectedCode);
        }),
      };
      const processor = new ParseStageProcessor({
        segments: {
          openAuthorized: vi.fn(async () => [
            {
              id: "segment-fixture",
              kind: "paragraph" as const,
              text: "Synthetic",
            },
          ]),
        },
        deterministic: parser,
        drafts,
      } as never);
      const outcome = await processor.process(
        {
          id: seeded.parseId!,
          uploadId: seeded.uploadId,
          accountId: seeded.accountId,
          attemptNumber: 1,
          leaseOwner: seeded.leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
        { signal, now },
      );
      expect(outcome).toEqual({ status: "FAILED", failureCode: expectedCode });
      expect(
        await new PrismaCvWorkRepository().finalizeStage({
          stage: "PARSE",
          id: seeded.parseId!,
          owner: seeded.leaseOwner,
          status: "FAILED",
          failureCode: expectedCode,
          now,
        }),
      ).toBe(true);
      expect(await uploadState(seeded.uploadId)).toMatchObject({
        status: "PARSE_FAILED",
        failureCode: expectedCode,
        contentInaccessibleAt: null,
      });
      const state = await pool.query<{ drafts: number; artifacts: number }>(
        `SELECT
         (SELECT count(*)::int FROM "CvDraft" WHERE "uploadId" = $1) AS drafts,
         (SELECT count(*)::int FROM "CvStoredArtifact" WHERE "uploadId" = $1) AS artifacts`,
        [seeded.uploadId],
      );
      expect(state.rows[0]).toEqual({ drafts: 0, artifacts: 2 });
    },
  );

  it("writes exactly one content-free audit for an authorized external dispatch failure", async () => {
    const rawProviderError =
      "raw provider body echoed privacy-person@example.invalid and sk-never-record";
    const client = await pool.connect();
    let seeded!: Awaited<ReturnType<typeof seedCvRecoveryImport>>;
    let consentId!: string;
    const dispatchAt = new Date(now.getTime() + 1);
    try {
      seeded = await seedCvRecoveryImport(client, "external-dispatch-audit", {
        stage: "PARSE",
        mode: "TERMINAL_FAILURE",
        parserClass: "EXTERNAL_OPENAI",
        now,
      });
      accounts.push(seeded.accountId);
      consentId = await grantExactRecoveryConsent(client, seeded, now);
      await client.query(
        `INSERT INTO "CvParseJob" (
           "id", "uploadId", "extractionId", "accountId", "consentEventId",
           "previousAttemptId", "attemptNumber", "trigger", "status", "parserClass",
           "provider", "model", "purposeVersion", "inputVersion", "instructionVersion",
           "schemaVersion", "createdAt"
         ) VALUES ($1, $2, $3, $4, $5, $6, 2, 'CANDIDATE_RETRY', 'QUEUED',
           'EXTERNAL_OPENAI', 'openai', 'gpt-5.4-mini-2026-03-17',
           'cv-profile-fact-extraction-v1', 'cv-segments-v1', 'cv-extract-v1',
           'cv-draft-v1', $7::timestamp(3))`,
        [
          `${seeded.parseId}-retry`,
          seeded.uploadId,
          seeded.extractionId,
          seeded.accountId,
          consentId,
          seeded.parseId,
          dispatchAt,
        ],
      );
      await client.query(
        `UPDATE "CvUpload" SET "status" = 'PARSE_QUEUED', "failureCode" = NULL
          WHERE "id" = $1`,
        [seeded.uploadId],
      );
    } finally {
      client.release();
    }
    const repository = new PrismaCvWorkRepository();
    const claims = await repository.claimStage({
      stage: "PARSE",
      owner: "external-audit-worker",
      now: dispatchAt,
      limit: 1,
      leaseMs: 90_000,
    });
    expect(claims).toHaveLength(1);
    const claim = claims[0]!;

    const external = {
      parserClass: "EXTERNAL_OPENAI" as const,
      parse: vi.fn(async () => {
        throw new Error(rawProviderError);
      }),
    };
    const processor = new ParseStageProcessor({
      segments: {
        openAuthorized: vi.fn(async () => [
          {
            id: "segment-fixture",
            kind: "paragraph" as const,
            text: "Synthetic",
          },
        ]),
      },
      deterministic: {
        parserClass: "DETERMINISTIC_INTERNAL" as const,
        parse: vi.fn(),
      },
      external,
      drafts: { execute: vi.fn() },
      consent: {
        findLiveExternalConsent: vi.fn(async () => ({
          consentId,
          occurredAt: now,
        })),
      },
      configuration: approvedExternalConfiguration(),
      safetySecret: "synthetic-safety-secret-32-bytes-minimum",
    } as never);
    const outcome = await processor.process(claim, { signal, now: dispatchAt });
    expect(outcome).toEqual({
      status: "FAILED",
      failureCode: "PARSER_UNAVAILABLE",
    });
    expect(external.parse).toHaveBeenCalledOnce();
    const audit = await pool.query<{
      action: string;
      result: string;
      context: unknown;
    }>(
      `SELECT "action", "result"::text, "context" FROM "AuditEvent"
        WHERE "targetId" = $1 AND "action" = 'cv_import.external_dispatch_failed'`,
      [seeded.uploadId],
    );
    expect(audit.rows).toEqual([
      {
        action: "cv_import.external_dispatch_failed",
        result: "FAILURE",
        context: {
          stage: "PARSE",
          state: "DISPATCH_FAILED",
          failureCode: "PARSER_UNAVAILABLE",
          parserClass: "EXTERNAL_OPENAI",
          schemaVersion: "cv-draft-v1",
        },
      },
    ]);
    expect(JSON.stringify(audit.rows)).not.toContain(rawProviderError);
    expect(
      await repository.finalizeStage({
        stage: "PARSE",
        id: claim.id,
        owner: claim.leaseOwner,
        status: "FAILED",
        failureCode: "PARSER_UNAVAILABLE",
        now: dispatchAt,
      }),
    ).toBe(true);
    expect(
      await repository.finalizeStage({
        stage: "PARSE",
        id: claim.id,
        owner: claim.leaseOwner,
        status: "FAILED",
        failureCode: "PARSER_UNAVAILABLE",
        now: dispatchAt,
      }),
    ).toBe(false);
    expect(
      await pool.query(
        `SELECT 1 FROM "AuditEvent" WHERE "targetId" = $1
          AND "action" = 'cv_import.external_dispatch_failed'`,
        [seeded.uploadId],
      ),
    ).toHaveProperty("rowCount", 1);
  });

  it.each([
    ["a lost lease", "LEASE_LOST"],
    ["an inaccessible import", "IMPORT_INACCESSIBLE"],
  ])(
    "discards a completed parser result after %s without creating a draft or changing the aggregate",
    async (_label, invalidation) => {
      const client = await pool.connect();
      const seeded = await seedCvRecoveryImport(
        client,
        `parse-discard-${invalidation.toLowerCase()}`,
        { stage: "PARSE", now },
      );
      accounts.push(seeded.accountId);
      client.release();

      let releaseParser!: () => void;
      const parserBlocked = new Promise<void>((resolve) => {
        releaseParser = resolve;
      });
      const parser = {
        parserClass: "DETERMINISTIC_INTERNAL" as const,
        parse: vi.fn(async () => {
          await parserBlocked;
          return { output: {}, dispatch: {} };
        }),
      };
      const drafts = { execute: vi.fn(async () => ({ id: "draft" })) };
      const processor = new ParseStageProcessor({
        segments: {
          openAuthorized: vi.fn(async () => [
            {
              id: "segment-fixture",
              kind: "paragraph" as const,
              text: "Synthetic",
            },
          ]),
        },
        deterministic: parser,
        drafts,
      } as never);
      const completion = new Date(now.getTime() + 1_000);
      const processing = processor.process(
        {
          id: seeded.parseId!,
          uploadId: seeded.uploadId,
          accountId: seeded.accountId,
          attemptNumber: 1,
          leaseOwner: seeded.leaseOwner,
          leaseExpiresAt: new Date(now.getTime() + 60_000),
        },
        { signal, now, currentTime: () => completion },
      );
      await vi.waitFor(() => expect(parser.parse).toHaveBeenCalledOnce());

      if (invalidation === "LEASE_LOST") {
        await pool.query(
          `UPDATE "CvParseJob"
              SET "leaseOwner" = 'replacement-worker',
                  "leaseExpiresAt" = $2::timestamp(3) + interval '1 minute'
            WHERE "id" = $1`,
          [seeded.parseId, completion],
        );
      } else {
        await pool.query(
          `UPDATE "CvUpload"
              SET "status" = 'CANCELLED', "contentInaccessibleAt" = $2
            WHERE "id" = $1`,
          [seeded.uploadId, completion],
        );
      }
      releaseParser();

      await expect(processing).rejects.toThrow("CV_STAGE_RESULT_DISCARDED");
      expect(drafts.execute).not.toHaveBeenCalled();
      const state = await pool.query<{
        uploadStatus: string;
        drafts: number;
      }>(
        `SELECT upload."status"::text AS "uploadStatus",
                (SELECT count(*)::int FROM "CvDraft" WHERE "uploadId" = upload."id") AS drafts
           FROM "CvUpload" upload WHERE upload."id" = $1`,
        [seeded.uploadId],
      );
      expect(state.rows[0]).toEqual({
        uploadStatus: invalidation === "LEASE_LOST" ? "PARSING" : "CANCELLED",
        drafts: 0,
      });
    },
  );
});
