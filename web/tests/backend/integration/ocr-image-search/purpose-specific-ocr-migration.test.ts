import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tables = [
  "OcrProcessingAttempt",
  "OcrUnitOutcome",
  "SearchImageQuery",
  "SearchStoredArtifact",
  "SearchScanAssessment",
  "SearchImageDecodeAttempt",
  "SearchIntentAttempt",
  "SearchProcessingConsent",
  "ImageSearchAdmissionEvent",
];
const enumValues = {
  OcrProcessingPurpose: ["CV_IMPORT", "JOB_IMAGE_SEARCH"],
  OcrAttemptStatus: [
    "QUEUED",
    "PROCESSING",
    "SUCCEEDED",
    "PARTIAL_REVIEW_REQUIRED",
    "FAILED",
    "CANCELLED",
  ],
  OcrUnitKind: ["PDF_PAGE", "DOCX_BODY_IMAGE", "SEARCH_IMAGE"],
  SearchActorClass: ["VISITOR", "AUTHENTICATED"],
  SearchArtifactKind: [
    "SOURCE_IMAGE",
    "NORMALIZED_IMAGE",
    "OCR_TEXT",
    "VALIDATED_INTENT",
  ],
  SearchResultKind: ["VALIDATED_INTENT", "OCR_TEXT_FALLBACK"],
} as const;

afterAll(async () => pool.end());

describe.sequential("Feature 005 additive migration", () => {
  it("installs every purpose-specific table and exact core enums", async () => {
    const found = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name = ANY($1::text[])`,
      [tables],
    );
    expect(found.rows.map((row) => row.table_name).sort()).toEqual(
      [...tables].sort(),
    );
    for (const [name, expected] of Object.entries(enumValues)) {
      const result = await pool.query<{ enumlabel: string }>(
        `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
          WHERE t.typname=$1 ORDER BY e.enumsortorder`,
        [name],
      );
      expect(
        result.rows.map((row) => row.enumlabel),
        name,
      ).toEqual(expected);
    }
  });

  it("adds only nullable Feature 005 metadata to CvExtraction", async () => {
    const expected = [
      "segmentSchemaVersion",
      "eligibilityPolicyVersion",
      "deduplicationPolicyVersion",
      "confidencePolicyVersion",
      "nativeSegmentCount",
      "ocrSegmentCount",
      "accountedUnitCount",
      "lowConfidenceUnitCount",
      "conflictUnitCount",
    ];
    const result = await pool.query<{
      column_name: string;
      is_nullable: string;
    }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='CvExtraction'
          AND column_name = ANY($1::text[])`,
      [expected],
    );
    expect(result.rows.map((row) => row.column_name).sort()).toEqual(
      [...expected].sort(),
    );
    expect(result.rows.every((row) => row.is_nullable === "YES")).toBe(true);
  });

  it("installs hard checks, partial unique indexes, claim indexes, and immutable deadlines", async () => {
    const checks = [
      "OcrProcessingAttempt_parent_purpose",
      "OcrProcessingAttempt_counts",
      "OcrUnitOutcome_location",
      "SearchImageQuery_actor",
      "SearchImageQuery_media",
      "SearchImageQuery_deadline",
      "SearchStoredArtifact_envelope",
      "SearchStoredArtifact_limits",
      "SearchImageDecodeAttempt_success",
      "SearchIntentAttempt_counts",
    ];
    const constraints = await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])`,
      [checks],
    );
    expect(constraints.rows.map((row) => row.conname).sort()).toEqual(
      [...checks].sort(),
    );
    const indexes = [
      "SearchImageQuery_account_idempotency_idx",
      "SearchImageQuery_visitor_idempotency_idx",
      "SearchStoredArtifact_live_locator_idx",
      "SearchScanAssessment_one_active_idx",
      "SearchImageDecodeAttempt_one_active_idx",
      "SearchIntentAttempt_one_active_idx",
      "ImageSearchAdmissionEvent_subject_window_idx",
    ];
    const foundIndexes = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'
        AND indexname = ANY($1::text[])`,
      [indexes],
    );
    expect(foundIndexes.rows.map((row) => row.indexname).sort()).toEqual(
      [...indexes].sort(),
    );
    const triggers = await pool.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])`,
      [
        [
          "SearchImageQuery_deadline_immutable",
          "SearchStoredArtifact_deadline_immutable",
          "SearchProcessingConsent_append_only",
          "ImageSearchAdmissionEvent_append_only",
        ],
      ],
    );
    expect(triggers.rowCount).toBe(4);
  });

  it("enforces deleteBy as admittedAt plus exactly 15 minutes and prevents mutation", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const id = `search-${randomUUID()}`;
      await client.query(
        `INSERT INTO "SearchImageQuery" (
          "id", "actorClass", "visitorSubjectDigest", "visitorCapabilityDigest",
          "capabilityKeyVersion", "status", "interpreterClass",
          "declaredExtension", "declaredMediaType", "declaredBytes",
          "idempotencyDigest", "createBindingDigest", "admittedAt", "expiresAt",
          "deleteBy", "createdAt", "updatedAt"
        ) VALUES (
          $1, 'VISITOR', decode(repeat('11',32),'hex'), decode(repeat('22',32),'hex'),
          1, 'AWAITING_CONTENT', 'DETERMINISTIC_INTERNAL', 'png', 'image/png', 1,
          decode(repeat('33',32),'hex'), decode(repeat('44',32),'hex'),
          now(), now()+interval '15 minutes', now()+interval '15 minutes', now(), now()
        )`,
        [id],
      );
      await expect(
        client.query(
          `UPDATE "SearchImageQuery" SET "deleteBy"="deleteBy"+interval '1 second' WHERE "id"=$1`,
          [id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("has no relation to job, Profile, application, saved-job, or Better Auth tables", async () => {
    const result = await pool.query<{ foreign_table_name: string }>(
      `SELECT ccu.table_name AS foreign_table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name=tc.constraint_name
          AND ccu.constraint_schema=tc.constraint_schema
        WHERE tc.constraint_type='FOREIGN KEY'
          AND tc.table_name = ANY($1::text[])`,
      [tables],
    );
    expect(result.rows.map((row) => row.foreign_table_name)).not.toEqual(
      expect.arrayContaining([
        "JobPosting",
        "CandidateProfile",
        "JobApplication",
        "SavedJob",
        "Session",
      ]),
    );
  });

  it("is forward-only and does not rewrite Feature 001-004 structures", async () => {
    const migration = await readFile(
      resolve(
        process.cwd(),
        "prisma/migrations/010_purpose_specific_ocr/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("Rollback safety");
    expect(migration).not.toMatch(
      /DROP\s+(?:TABLE|TYPE|COLUMN)|ALTER\s+TABLE\s+(?:"user"|"Session"|"JobPosting"|"CandidateProfile")/iu,
    );
  });
});
