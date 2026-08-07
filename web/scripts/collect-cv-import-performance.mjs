import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { config as loadEnvironment } from "dotenv";
import { Pool } from "pg";

import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
} from "../tests/helpers/cv-failure-retry-fixture.ts";
import { cleanupReviewAccounts } from "../tests/helpers/cv-review-fixture.ts";

const webRoot = process.cwd();
loadEnvironment({ path: resolve(webRoot, ".env.local"), quiet: true });

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:3001";
const iterations = Number.parseInt(process.env.CV_PERF_ITERATIONS ?? "60", 10);
const journeyConcurrency = Number.parseInt(
  process.env.CV_PERF_JOURNEY_CONCURRENCY ?? "2",
  10,
);
const claims = Number.parseInt(process.env.CV_PERF_CLAIM_SAMPLES ?? "20", 10);
const cleanupUnits = Number.parseInt(
  process.env.CV_PERF_CLEANUP_UNITS ?? "100",
  10,
);
const claimConcurrency = Number.parseInt(
  process.env.CV_PERF_CLAIM_CONCURRENCY ?? "8",
  10,
);
const workerRssCeilingBytes = Number.parseInt(
  process.env.CV_PERF_WORKER_RSS_CEILING_BYTES ?? String(512 * 1024 * 1024),
  10,
);
const allowedOutputRoot = resolve(webRoot, ".local");
const outputPath = resolve(
  webRoot,
  process.env.CV_PERF_OUTPUT ?? ".local/cv-import-performance-input.json",
);
const outputRelativePath = relative(allowedOutputRoot, outputPath);
const password = "Synthetic CV performance 004!";
const controlledEligibleAt = new Date();
const controlledDeadlineAt = new Date(
  controlledEligibleAt.getTime() + 24 * 60 * 60_000,
);

for (const [name, value, minimum] of [
  ["CV_PERF_ITERATIONS", iterations, 2],
  ["CV_PERF_JOURNEY_CONCURRENCY", journeyConcurrency, 2],
  ["CV_PERF_CLAIM_SAMPLES", claims, 1],
  ["CV_PERF_CLEANUP_UNITS", cleanupUnits, 1],
  ["CV_PERF_CLAIM_CONCURRENCY", claimConcurrency, 2],
  ["CV_PERF_WORKER_RSS_CEILING_BYTES", workerRssCeilingBytes, 1],
]) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name}_INVALID`);
  }
}
if (journeyConcurrency !== 2) {
  throw new Error("CV_PERF_JOURNEY_CONCURRENCY_MUST_BE_TWO");
}
if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
  throw new Error("CV_PERF_DATABASE_URLS_REQUIRED");
}
if (cleanupUnits > 100) {
  throw new Error("CV_PERF_CLEANUP_UNITS_EXCEED_BATCH_CAP");
}
if (
  !outputRelativePath ||
  outputRelativePath.startsWith("..") ||
  isAbsolute(outputRelativePath) ||
  extname(outputPath) !== ".json"
) {
  throw new Error("CV_PERF_OUTPUT_PATH_UNSAFE");
}

function latency(operation, durationMs, condition) {
  return {
    kind: "LATENCY",
    operation,
    durationMs: Number(durationMs.toFixed(2)),
    outcome: "SUCCESS",
    resultCode: "CV_SYNTHETIC_OK",
    condition,
  };
}

function resource(metric, valueBytes, ceilingBytes, condition) {
  return { kind: "RESOURCE", metric, valueBytes, ceilingBytes, condition };
}

async function formatFixture(index) {
  const corpusRoot = resolve(webRoot, "tests/fixtures/ocr-corpus");
  const manifest = JSON.parse(
    await readFile(resolve(corpusRoot, "manifest.json"), "utf8"),
  );
  const fixtures = manifest.fixtures.filter(
    (fixture) => fixture.purpose === "CV" && fixture.documentPath,
  );
  if (fixtures.length < 60) throw new Error("CV_PERF_CORPUS_FLOOR_NOT_MET");
  const fixture = fixtures[index % fixtures.length];
  return {
    format: "PDF",
    sizeClass: index % 3,
    wordCount: fixture.wordCount,
    name: `${fixture.id}.pdf`,
    mimeType: "application/pdf",
    buffer: await readFile(resolve(corpusRoot, fixture.documentPath)),
  };
}

function parseByteSize(value) {
  const match = value.trim().match(/^([0-9.]+)(B|KiB|MiB|GiB)$/u);
  if (!match) throw new Error("CV_PERF_DOCKER_MEMORY_FORMAT_INVALID");
  const factors = { B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3 };
  return Math.round(Number(match[1]) * factors[match[2]]);
}

function workerMemoryBytes() {
  const raw = execFileSync(
    "docker",
    ["stats", "--no-stream", "--format", "{{json .}}", "smarthire-cv-worker-1"],
    { encoding: "utf8", windowsHide: true },
  ).trim();
  const stats = JSON.parse(raw);
  return parseByteSize(String(stats.MemUsage).split("/")[0]);
}

async function seedCandidate(pool, index) {
  const suffix = randomUUID();
  const accountId = `cv-perf-account-${suffix}`;
  const profileId = `cv-perf-profile-${suffix}`;
  const email = `cv-performance-${index}-${suffix}@example.test`;
  const digest = await hashPassword(password);
  const now = new Date();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "user" (
         "id", "name", "email", "normalizedEmail", "emailVerified", "state",
         "stateChangedAt", "createdAt", "updatedAt"
       ) VALUES ($1, 'Synthetic Performance Candidate', $2, $2, true, 'ACTIVE',
                 $3, $3, $3)`,
      [accountId, email, now],
    );
    await client.query(
      `INSERT INTO "account" (
         "id", "accountId", "providerId", "userId", "password", "createdAt",
         "updatedAt"
       ) VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
      [randomUUID(), accountId, digest, now],
    );
    await client.query(
      `INSERT INTO "CandidateIdentity" ("userId", "createdAt", "updatedAt")
       VALUES ($1, $2, $2)`,
      [accountId, now],
    );
    await client.query(
      `INSERT INTO "CandidateProfile" (
         "id", "candidateUserId", "revision", "createdAt", "updatedAt"
       ) VALUES ($1, $2, 0, $3, $3)`,
      [profileId, accountId, now],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { accountId, email };
}

async function signIn(browser, email) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      new URL(candidate.url()).pathname === "/api/identity/login",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  if ((await response).status() !== 200) {
    throw new Error("CV_PERF_LOGIN_FAILED");
  }
  await page.waitForURL(/\/dashboard$/u);
  return { context, page };
}

async function measureJourney(page, pool, index, observations) {
  const fixture = await formatFixture(index);
  const condition = index === 0 ? "COLD" : "WARM";
  const selectedHeadline = `Measured Synthetic Engineer ${index}`;
  const profileBefore = await page.request
    .get(`${baseUrl}/api/account/profile`)
    .then((response) => response.json());

  await page.goto(`${baseUrl}/profile/cv-imports`);
  await page.waitForFunction(() => {
    const input = document.querySelector("#cv-upload-file");
    return input instanceof HTMLInputElement && !input.disabled;
  });
  const fileInput = page.getByLabel("CV file");
  await fileInput.setInputFiles({
    name: fixture.name,
    mimeType: fixture.mimeType,
    buffer: fixture.buffer,
  });
  await page
    .getByRole("status")
    .filter({ hasText: /is ready to upload/iu })
    .waitFor();
  const reservationPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/account/cv-imports",
  );
  const contentPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      /\/api\/account\/cv-imports\/[A-Za-z0-9_-]+\/content$/u.test(
        new URL(response.url()).pathname,
      ),
  );
  const uploadStartedAt = performance.now();
  await page.getByRole("button", { name: /upload cv/iu }).click();
  const reservation = await reservationPromise;
  if (reservation.status() !== 201) {
    throw new Error(`CV_PERF_RESERVATION_FAILED_${reservation.status()}`);
  }
  const content = await contentPromise;
  await content.finished();
  observations.push(
    latency(
      "UPLOAD_FINALIZATION_PRE_SCAN",
      performance.now() - uploadStartedAt,
      condition,
    ),
  );
  if (content.status() !== 202) {
    throw new Error(`CV_PERF_CONTENT_FAILED_${content.status()}`);
  }
  const { uploadId } = await reservation.json();
  await page
    .getByRole("status")
    .filter({ hasText: /review ready/iu })
    .waitFor({ timeout: 180_000 });
  observations.push(
    latency(
      "QUEUE_TO_ACTIONABLE_TERMINAL",
      performance.now() - uploadStartedAt,
      condition,
    ),
  );

  const stage = await pool.query(
    `SELECT scan."startedAt" AS "scanStartedAt",
            scan."completedAt" AS "scanCompletedAt",
            extraction."startedAt" AS "extractionStartedAt",
            extraction."completedAt" AS "extractionCompletedAt",
            parse."startedAt" AS "parseStartedAt",
            parse."completedAt" AS "parseCompletedAt",
            source."plaintextBytes" AS "sourceBytes",
            extraction."extractedUtf8Bytes" AS "extractedBytes",
            draft."id" AS "draftId", draft."payloadBytes",
            draft."provenanceBytes"
       FROM "CvUpload" upload
       JOIN "CvScanAssessment" scan ON scan."uploadId" = upload."id"
       JOIN "CvExtraction" extraction ON extraction."uploadId" = upload."id"
       JOIN "CvParseJob" parse ON parse."uploadId" = upload."id"
       JOIN "CvStoredArtifact" source
         ON source."uploadId" = upload."id" AND source."kind" = 'SOURCE_DOCUMENT'
       JOIN "CvDraft" draft ON draft."uploadId" = upload."id"
      WHERE upload."id" = $1`,
    [uploadId],
  );
  const row = stage.rows[0];
  if (!row) throw new Error("CV_PERF_STAGE_EVIDENCE_MISSING");
  observations.push(
    latency(
      "STAGE_SCAN",
      row.scanCompletedAt.getTime() - row.scanStartedAt.getTime(),
      condition,
    ),
    latency(
      "STAGE_EXTRACTION",
      row.extractionCompletedAt.getTime() - row.extractionStartedAt.getTime(),
      condition,
    ),
    latency(
      "STAGE_PARSE",
      row.parseCompletedAt.getTime() - row.parseStartedAt.getTime(),
      condition,
    ),
    resource(
      "SOURCE_DOCUMENT_BYTES",
      Number(row.sourceBytes),
      5_000_000,
      condition,
    ),
    resource(
      "EXTRACTED_TEXT_BYTES",
      Number(row.extractedBytes),
      512 * 1024,
      condition,
    ),
    resource(
      "DRAFT_PAYLOAD_BYTES",
      Number(row.payloadBytes),
      256 * 1024,
      condition,
    ),
    resource(
      "PROVENANCE_PAYLOAD_BYTES",
      Number(row.provenanceBytes),
      128 * 1024,
      condition,
    ),
    resource(
      "WORKER_RSS_BYTES",
      workerMemoryBytes(),
      workerRssCeilingBytes,
      condition,
    ),
  );

  const reviewStartedAt = performance.now();
  await page.goto(`${baseUrl}/profile/cv-imports/${uploadId}/review`);
  await page.getByRole("heading", { name: "Review CV proposals" }).waitFor();
  observations.push(
    latency("REVIEW_LOAD", performance.now() - reviewStartedAt, condition),
  );
  await page.getByLabel("Proposed headline").fill(selectedHeadline);
  await page
    .getByRole("group", { name: "Decision for headline" })
    .getByRole("radio", {
      name: profileBefore.basics.headline === null ? "add" : "replace",
    })
    .check();
  await page
    .getByRole("checkbox", { name: "I have reviewed every proposal." })
    .check();
  const saveStartedAt = performance.now();
  await page.getByRole("button", { name: "Save review" }).click();
  await page
    .getByRole("status")
    .getByText(/Review saved/iu)
    .waitFor();
  observations.push(
    latency("DRAFT_SAVE", performance.now() - saveStartedAt, condition),
  );
  const unchanged = await page.request
    .get(`${baseUrl}/api/account/profile`)
    .then((response) => response.json());
  if (JSON.stringify(unchanged) !== JSON.stringify(profileBefore)) {
    throw new Error("CV_PERF_PROFILE_CHANGED_BEFORE_CONFIRM");
  }

  await page
    .getByRole("checkbox", { name: /Confirm updates my Candidate Profile/iu })
    .check();
  const confirmationPromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname ===
        `/api/account/cv-drafts/${row.draftId}/confirm`,
  );
  const confirmStartedAt = performance.now();
  await page.getByRole("button", { name: "Confirm selected changes" }).click();
  await page.getByRole("heading", { name: "CV import confirmed" }).waitFor();
  const confirmation = await confirmationPromise;
  if (confirmation.status() !== 201) throw new Error("CV_PERF_CONFIRM_FAILED");
  observations.push(
    latency("CONFIRM", performance.now() - confirmStartedAt, condition),
  );
  const profileAfter = await page.request
    .get(`${baseUrl}/api/account/profile`)
    .then((response) => response.json());
  if (
    profileAfter.revision !== profileBefore.revision + 1 ||
    profileAfter.basics.headline !== selectedHeadline
  ) {
    throw new Error("CV_PERF_PROFILE_RESULT_INVALID");
  }
  return fixture;
}

async function collectClaims(pool, observations, supportAccounts) {
  const { PrismaCvWorkRepository } =
    await import("../src/backend/repositories/cv-import/prisma-cv-work-repository.ts");
  const fixtureNow = new Date(controlledEligibleAt.getTime() + 60 * 60_000);
  for (let index = 0; index < claims; index += 1) {
    const client = await pool.connect();
    let seeded;
    try {
      seeded = await seedCvRecoveryImport(client, `perf-claim-${index}`, {
        stage: "SCAN",
        mode: "PROCESSING",
        now: fixtureNow,
      });
      supportAccounts.push(seeded.accountId);
    } finally {
      client.release();
    }
    const claimAt = new Date(fixtureNow.getTime() + 2 * 60_000);
    const startedAt = performance.now();
    const settled = await Promise.allSettled(
      Array.from({ length: claimConcurrency }, async (_, contender) => {
        const owner = `cv-perf-claim-${index}-${contender}`;
        const result = await new PrismaCvWorkRepository().claimStage({
          stage: "SCAN",
          owner,
          now: claimAt,
          limit: 1,
          leaseMs: 60_000,
        });
        return { owner, result };
      }),
    );
    const fulfilled = settled
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value);
    const claimed = fulfilled.flatMap(({ owner, result }) =>
      result.map((item) => ({ owner, item })),
    );
    const unique = new Set(claimed.map(({ item }) => item.id));
    observations.push({
      kind: "CLAIM",
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      concurrency: claimConcurrency,
      successfulClaims: unique.size,
      duplicateClaims: claimed.length - unique.size,
      errors: settled.filter((entry) => entry.status === "rejected").length,
      condition: index === 0 ? "COLD" : "WARM",
    });
    const winner = claimed[0];
    if (winner) {
      await new PrismaCvWorkRepository().finalizeStage({
        stage: "SCAN",
        id: winner.item.id,
        owner: winner.owner,
        status: "CANCELLED",
        now: claimAt,
      });
    }
  }
}

async function collectCleanup(pool, observations, supportAccounts) {
  const [
    { PrismaCvWorkRepository },
    { CvRetentionService },
    { ControlledClock },
    { CvCleanupCoordinator },
    { createCvArtifactDeleteProcessor },
  ] = await Promise.all([
    import("../src/backend/repositories/cv-import/prisma-cv-work-repository.ts"),
    import("../src/backend/services/cv-import/cv-retention-service.ts"),
    import("../src/backend/time/clock.ts"),
    import("../src/backend/cv/workers/cleanup.ts"),
    import("../src/backend/cv/workers/pipeline.ts"),
  ]);
  const fixtures = [];
  for (let index = 0; index < cleanupUnits; index += 1) {
    const client = await pool.connect();
    try {
      const seeded = await seedCvRecoveryImport(
        client,
        `perf-cleanup-${index}`,
        {
          stage: "SCAN",
          mode: "TERMINAL_FAILURE",
          now: controlledEligibleAt,
        },
      );
      fixtures.push(seeded);
      supportAccounts.push(seeded.accountId);
    } finally {
      client.release();
    }
  }
  const retention = new CvRetentionService(
    new ControlledClock(controlledEligibleAt),
  );
  for (const fixture of fixtures) {
    const outcome = await retention.deleteOwnedImport({
      accountId: fixture.accountId,
      uploadId: fixture.uploadId,
    });
    if (
      new Date(outcome.deleteAfter).getTime() !== controlledDeadlineAt.getTime()
    ) {
      throw new Error("CV_PERF_CLEANUP_DEADLINE_INVALID");
    }
  }

  const repository = new PrismaCvWorkRepository();
  const work = await repository.claimStage({
    stage: "DELETE",
    owner: "cv-perf-delete-owner",
    now: controlledDeadlineAt,
    limit: 100,
    leaseMs: 60_000,
  });
  const absentStorage = {
    async assertReady() {},
    async put() {
      throw new Error("unused");
    },
    open() {
      return (async function* () {})();
    },
    async delete() {
      return { deleted: false };
    },
    async inventory() {
      return { items: [] };
    },
  };
  const processor = createCvArtifactDeleteProcessor(absentStorage);
  for (const item of work) {
    const result = await processor(item, {
      signal: new AbortController().signal,
      now: controlledDeadlineAt,
    });
    await repository.finalizeStage({
      stage: "DELETE",
      id: item.id,
      owner: "cv-perf-delete-owner",
      status: result.status,
      now: controlledDeadlineAt,
    });
  }
  await new CvCleanupCoordinator(
    new ControlledClock(controlledDeadlineAt),
  ).runOnce({ now: controlledDeadlineAt, limit: 100 });
  const completed = await pool.query(
    `SELECT upload."id", upload."status"::text AS "status",
            upload."deletedAt" IS NOT NULL AS "deleted",
            NOT EXISTS (
              SELECT 1 FROM "CvStoredArtifact" artifact
               WHERE artifact."uploadId" = upload."id"
                 AND artifact."status" <> 'DELETED'
            ) AS "artifactsAbsent",
            NOT EXISTS (
              SELECT 1 FROM "CvDraft" draft
               WHERE draft."uploadId" = upload."id"
                 AND draft."payloadDeletedAt" IS NULL
            ) AS "payloadsAbsent"
       FROM "CvUpload" upload
      WHERE upload."accountId" = ANY($1::text[])`,
    [fixtures.map(({ accountId }) => accountId)],
  );
  const successful = completed.rows.filter(
    (row) =>
      row.status === "DELETED" &&
      row.deleted &&
      row.artifactsAbsent &&
      row.payloadsAbsent,
  ).length;
  for (let index = 0; index < cleanupUnits; index += 1) {
    const complete = index < successful;
    observations.push({
      kind: "CLEANUP",
      eligibleAt: controlledEligibleAt.toISOString(),
      deadlineAt: controlledDeadlineAt.toISOString(),
      completedAt: complete ? controlledDeadlineAt.toISOString() : null,
      outcome: complete ? "COMPLETE" : "FAILED",
      manualIntervention: "NONE",
      resultCode: complete ? "CV_CLEANUP_COMPLETE" : "CV_CLEANUP_INCOMPLETE",
    });
  }
}

async function deleteExactArtifacts(pool, accountIds) {
  if (accountIds.length === 0) return;
  const artifacts = await pool.query(
    `SELECT "storageLocator" FROM "CvStoredArtifact"
      WHERE "accountId" = ANY($1::text[]) AND "storageAdapter" = 'filesystem'`,
    [accountIds],
  );
  const allowedRoot = resolve(webRoot, ".local/cv-storage");
  const configuredRoot = resolve(
    process.env.CV_STORAGE_LOCAL_ROOT ?? allowedRoot,
  );
  if (artifacts.rows.length > 0 && configuredRoot !== allowedRoot) {
    throw new Error("CV_PERF_STORAGE_ROOT_UNSAFE");
  }
  for (const { storageLocator } of artifacts.rows) {
    if (!/^[A-Za-z0-9_-]{32,128}$/u.test(storageLocator)) {
      throw new Error("CV_PERF_STORAGE_LOCATOR_UNSAFE");
    }
    const target = resolve(configuredRoot, storageLocator);
    const path = relative(configuredRoot, target);
    if (
      !path ||
      path.startsWith("..") ||
      path.includes("/") ||
      path.includes("\\")
    ) {
      throw new Error("CV_PERF_STORAGE_TARGET_UNSAFE");
    }
    await unlink(target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function assertAccountsAbsent(pool, accountIds, errorCode) {
  if (accountIds.length === 0) return;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS "count" FROM "user" WHERE "id" = ANY($1::text[])`,
    [accountIds],
  );
  if (result.rows[0]?.count !== 0) throw new Error(errorCode);
}

const wallStartedAt = performance.now();
const observations = [];
const candidateAccounts = [];
const supportAccounts = [];
const contexts = [];
const dataset = {
  documents: iterations,
  labeledWords: 0,
  pdf: 0,
  docx: 0,
  small: 0,
  medium: 0,
  large: 0,
};
const database = new Pool({ connectionString: process.env.DATABASE_URL });
let browser;
let captureError;
let captureSummary;
let cleanupError;

try {
  await unlink(outputPath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  const health = await fetch(`${baseUrl}/api/health`, {
    signal: AbortSignal.timeout(2_000),
  });
  if (!health.ok) throw new Error("CV_PERF_SERVER_NOT_READY");
  browser = await chromium.launch({ headless: true });
  const accountCount = Math.ceil(iterations / 5);
  const pages = [];
  for (let index = 0; index < accountCount; index += 1) {
    const candidate = await seedCandidate(database, index);
    candidateAccounts.push(candidate.accountId);
    const signedIn = await signIn(browser, candidate.email);
    contexts.push(signedIn.context);
    pages.push(signedIn.page);
  }
  for (let index = 0; index < iterations; index += journeyConcurrency) {
    const batch = await Promise.all(
      Array.from(
        { length: Math.min(journeyConcurrency, iterations - index) },
        (_, offset) => {
          const fixtureIndex = index + offset;
          return measureJourney(
            pages[Math.floor(fixtureIndex / 5)],
            database,
            fixtureIndex,
            observations,
          );
        },
      ),
    );
    for (const fixture of batch) {
      dataset[fixture.format.toLowerCase()] += 1;
      dataset[["small", "medium", "large"][fixture.sizeClass]] += 1;
      dataset.labeledWords += fixture.wordCount;
    }
  }
  await collectClaims(database, observations, supportAccounts);
  await collectCleanup(database, observations, supportAccounts);
  const input = {
    schemaVersion: "cv-import-performance-v1",
    mode: "MEASURED",
    metadata: {
      measurementWindow: {
        startedAt: controlledEligibleAt.toISOString(),
        endedAt: controlledDeadlineAt.toISOString(),
        wallDurationMs: Number((performance.now() - wallStartedAt).toFixed(2)),
        clock: "CONTROLLED_RETENTION_CLOCK",
      },
      conditions: {
        concurrency: journeyConcurrency,
        server: "NEXT_DEVELOPMENT",
        scanner: "CLAMAV_UNIX_SOCKET",
        parser: "DETERMINISTIC_INTERNAL",
        storage: "LOCAL_ENCRYPTED",
        network: "LOOPBACK",
        coldWarm: "ONE_COLD_REMAINDER_WARM",
      },
      dataset,
    },
    observations,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  captureSummary = {
    outputPath,
    documents: iterations,
    claims,
    cleanupUnits,
    observations: observations.length,
    wallDurationMs: input.metadata.measurementWindow.wallDurationMs,
  };
} catch (error) {
  captureError = error;
} finally {
  const cleanupFailures = [];
  await Promise.allSettled(contexts.map((context) => context.close()));
  if (browser) await browser.close().catch(() => undefined);
  let candidateArtifactCleanupSucceeded = true;
  try {
    await deleteExactArtifacts(database, candidateAccounts);
  } catch {
    candidateArtifactCleanupSucceeded = false;
    cleanupFailures.push("CANDIDATE_ARTIFACTS");
    process.stderr.write("CV_PERF_CANDIDATE_ARTIFACT_CLEANUP_FAILED\n");
  }
  if (candidateArtifactCleanupSucceeded && candidateAccounts.length > 0) {
    try {
      const client = await database.connect();
      try {
        await cleanupReviewAccounts(client, candidateAccounts);
      } finally {
        client.release();
      }
      await assertAccountsAbsent(
        database,
        candidateAccounts,
        "CV_PERF_CANDIDATE_CLEANUP_INCOMPLETE",
      );
    } catch {
      cleanupFailures.push("CANDIDATE_ROWS");
      process.stderr.write("CV_PERF_CANDIDATE_ROW_CLEANUP_FAILED\n");
    }
  }
  if (supportAccounts.length > 0) {
    try {
      const client = await database.connect();
      try {
        await cleanupCvRecoveryAccounts(client, supportAccounts);
      } finally {
        client.release();
      }
      await assertAccountsAbsent(
        database,
        supportAccounts,
        "CV_PERF_SUPPORT_CLEANUP_INCOMPLETE",
      );
    } catch {
      cleanupFailures.push("SUPPORT_ROWS");
      process.stderr.write("CV_PERF_SUPPORT_ROW_CLEANUP_FAILED\n");
    }
  }
  try {
    await database.end();
  } catch {
    cleanupFailures.push("DATABASE_POOL");
    process.stderr.write("CV_PERF_DATABASE_POOL_CLEANUP_FAILED\n");
  }
  await delay(10);
  if (cleanupFailures.length > 0) {
    await unlink(outputPath).catch((error) => {
      if (error.code !== "ENOENT") cleanupFailures.push("OUTPUT");
    });
    cleanupError = new Error(
      `CV_PERF_FINAL_CLEANUP_FAILED_${cleanupFailures.join("_")}`,
    );
  } else {
    process.stderr.write("CV_PERF_FINAL_CLEANUP_COMPLETE\n");
  }
}

if (cleanupError) throw cleanupError;
if (captureError) throw captureError;
process.stdout.write(
  `CV_IMPORT_PERFORMANCE_CAPTURED ${JSON.stringify(captureSummary)}\n`,
);
