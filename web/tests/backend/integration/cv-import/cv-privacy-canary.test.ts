import { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { createCvImportResourceHandlers } from "@/app/api/account/cv-imports/[uploadId]/handler";
import { cvConfiguration } from "@/backend/cv/config";
import { OpenAiCvParser } from "@/backend/cv/parsing/openai";
import { PrismaCvConsentRepository } from "@/backend/repositories/cv-import/prisma-cv-consent-repository";
import { cvExternalConsentBinding } from "@/backend/services/cv-import/cv-consent-service";
import { CvWorkerPipeline } from "@/backend/cv/workers/pipeline";
import { CvWorkerRuntime } from "@/backend/cv/workers/cv-worker-runtime";
import {
  cleanupCvRecoveryAccounts,
  seedCvRecoveryImport,
} from "../../../helpers/cv-failure-retry-fixture";

const canaries = Object.freeze({
  bytes: "JVBERi0xLjQKUFJJVkFDWV9DQU5BUlk=",
  text: "PRIVACY_CANARY confidential employment narrative",
  filename: "privacy-person@example.invalid.pdf",
  email: "privacy-person@example.invalid",
  phone: "+84987654321",
  digest: "d".repeat(64),
  locator: "privacy_canary_private_object_locator",
  consentText: "PRIVACY_CANARY consent disclosure",
  prompt: "PRIVACY_CANARY hidden parser prompt",
  providerResponse: "PRIVACY_CANARY raw provider response",
  token: "sk-PRIVACY_CANARY-never-record",
  session: "session_PRIVACY_CANARY_never_record",
});

const rawCanaries = Object.values(canaries);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const accountIds: string[] = [];

function expectNoCanary(value: unknown): void {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const canary of rawCanaries) expect(serialized).not.toContain(canary);
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (!accountIds.length) return;
  const client = await pool.connect();
  try {
    await cleanupCvRecoveryAccounts(client, accountIds.splice(0));
  } finally {
    client.release();
  }
});

afterAll(async () => pool.end());

describe.sequential("CV privacy canary across operational boundaries", () => {
  it("sanitizes nested provider failures without logging or persisting adapter input", async () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const create = vi.fn(async () => {
      throw Object.assign(new Error(JSON.stringify(canaries)), {
        response: canaries.providerResponse,
        authorization: canaries.token,
      });
    });
    const parser = new OpenAiCvParser({
      apiKey: "synthetic-approved-key",
      client: { responses: { create } },
    });
    let caught: unknown;
    try {
      await parser.parse({
        segments: [
          { id: "segment-canary", kind: "paragraph", text: canaries.text },
        ],
        safetyIdentifier: "safe_0123456789abcdefghijklmnopqrstuv",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ code: "PARSER_UNAVAILABLE" });
    expectNoCanary(caught);
    expectNoCanary(consoleInfo.mock.calls);
    expectNoCanary(consoleError.mock.calls);
  });

  it("keeps raw worker exceptions out of finalize, logger, metric, trace, and snapshots", async () => {
    const claim = {
      id: "privacy-worker-attempt",
      uploadId: "privacy-worker-upload",
      accountId: "privacy-worker-account",
      attemptNumber: 1,
      leaseOwner: "privacy-worker-owner",
      leaseExpiresAt: new Date("2026-08-02T00:01:30.000Z"),
    };
    let offered = false;
    const repository = {
      claimStage: vi.fn(async () => {
        if (offered) return [];
        offered = true;
        return [claim];
      }),
      finalizeStage: vi.fn(async () => true),
      releaseWorkerLeases: vi.fn(async () => 0),
    };
    const observability = {
      emitLog: vi.fn(),
      emitMetric: vi.fn(),
      emitTrace: vi.fn(),
    };
    const runtime = new CvWorkerRuntime({
      repository: repository as never,
      pipeline: new CvWorkerPipeline({
        PARSE: async () => {
          throw new Error(JSON.stringify(canaries));
        },
      }),
      clock: { now: () => new Date("2026-08-02T00:00:00.000Z") },
      owner: claim.leaseOwner,
      concurrency: 1,
      batchSize: 1,
      leaseMs: 90_000,
      observability,
    });
    expect(await runtime.pollOnce()).toBe(1);
    await vi.waitFor(() =>
      expect(observability.emitTrace).toHaveBeenCalledOnce(),
    );
    const surfaces = {
      finalize: repository.finalizeStage.mock.calls,
      log: observability.emitLog.mock.calls,
      metric: observability.emitMetric.mock.calls,
      trace: observability.emitTrace.mock.calls,
    };
    expectNoCanary(surfaces);
    expect(surfaces).toMatchInlineSnapshot(`
      {
        "finalize": [
          [
            {
              "failureCode": "CV_STAGE_FAILED",
              "id": "privacy-worker-attempt",
              "now": 2026-08-02T00:00:00.000Z,
              "owner": "privacy-worker-owner",
              "stage": "PARSE",
              "status": "FAILED",
            },
          ],
        ],
        "log": [
          [
            {
              "event": "cv.stage.failed",
              "resultCode": "CV_STAGE_FAILED",
              "stage": "PARSE",
              "state": "FAILED",
            },
          ],
        ],
        "metric": [
          [
            {
              "dimensions": {
                "resultCode": "CV_STAGE_FAILED",
                "stage": "PARSE",
                "state": "FAILED",
              },
              "metric": "cv_stage_outcome_total",
              "value": 1,
            },
          ],
        ],
        "trace": [
          [
            {
              "attributes": {
                "resultCode": "CV_STAGE_FAILED",
                "stage": "PARSE",
                "state": "FAILED",
              },
              "name": "cv.stage.outcome",
            },
          ],
        ],
      }
    `);
    await runtime.shutdown();
  });

  it("maps nested route failures to a content-free no-store response", async () => {
    const handlers = createCvImportResourceHandlers({
      boundary: {
        authorize: vi.fn(async () => ({
          accountId: "privacy-route-account",
          sessionId: "privacy-route-session",
        })),
      },
      retention: { deleteOwnedImport: vi.fn() },
      project: vi.fn(async () => {
        throw Object.assign(new Error(canaries.text), canaries);
      }),
    });
    const response = await handlers.GET(
      new Request(
        "http://localhost/api/account/cv-imports/privacy-route-upload",
        {
          headers: { "x-request-id": "privacy_route_request" },
        },
      ),
      { params: Promise.resolve({ uploadId: "privacy-route-upload" }) },
    );
    const surface = {
      status: response.status,
      cacheControl: response.headers.get("cache-control"),
      body: await response.json(),
    };
    expect(surface.status).toBe(503);
    expectNoCanary(surface);
  });

  it("keeps real consent audit evidence content-free even when adjacent import metadata contains canaries", async () => {
    const client = await pool.connect();
    let fixture: Awaited<ReturnType<typeof seedCvRecoveryImport>>;
    try {
      fixture = await seedCvRecoveryImport(client, "privacy-audit", {
        stage: "PARSE",
        mode: "TERMINAL_FAILURE",
        parserClass: "EXTERNAL_OPENAI",
        now: new Date("2026-08-02T00:00:00.000Z"),
      });
      accountIds.push(fixture.accountId);
      await client.query(
        `UPDATE "CvUpload" SET "displayFilenameCiphertext" = $2 WHERE "id" = $1`,
        [fixture.uploadId, canaries.filename],
      );
    } finally {
      client.release();
    }
    const repository = new PrismaCvConsentRepository(
      "privacy-canary-consent-secret-32-bytes",
    );
    const binding = cvExternalConsentBinding({
      accountId: fixture.accountId,
      uploadId: fixture.uploadId,
      configuration: cvConfiguration,
    });
    const occurredAt = new Date("2026-08-02T00:00:01.000Z");
    const challenge = await repository.issueChallenge(binding, occurredAt);
    const outcome = await repository.grant({
      ...binding,
      challenge,
      occurredAt,
    });
    const rows = await pool.query<{ action: string; context: unknown }>(
      `SELECT "action", "context" FROM "AuditEvent" WHERE "targetId" = $1`,
      [outcome.consentEventId],
    );
    expect(rows.rows).toEqual([
      {
        action: "cv_import.consent_granted",
        context: {
          state: "GRANTED",
          parserClass: "EXTERNAL_OPENAI",
          noticeVersion: "cv-processing.v1",
        },
      },
    ]);
    expectNoCanary(rows.rows);
    expect(JSON.stringify(rows.rows)).not.toContain(challenge);
  });
});
