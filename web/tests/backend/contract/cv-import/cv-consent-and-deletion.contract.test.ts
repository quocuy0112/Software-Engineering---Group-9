import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createCvConsentHandlers } from "@/app/api/account/cv-imports/[uploadId]/consent/handler";
import { createCvImportResourceHandlers } from "@/app/api/account/cv-imports/[uploadId]/handler";
import { CvRequestBoundaryError } from "@/backend/security/cv-account-request-boundary";
import {
  CV_EXTERNAL_CONSENT_NOTICE_TEXT,
  cvConsentGrantRequestSchema,
  cvConsentNoticeSchema,
  cvConsentOutcomeSchema,
  cvDeletionOutcomeSchema,
} from "@/shared/contracts/cv-import/consent-retention";
import {
  cvImportStatusResponseSchema,
  cvImportTombstoneSchema,
} from "@/shared/contracts/cv-import/upload";

const uploadId = "upload_retention_1234";
const challenge =
  "eyJ1IjoidXBsb2FkX2NvbnNlbnRfMTIzNCIsImwiOiIiLCJlIjoxNzg1NjMwMDAwfQ.signature_fixture_12345678901234567890";
const grantRequest = { accepted: true as const, consentChallenge: challenge };
const deletion = {
  uploadId,
  status: "CANCELLED" as const,
  contentInaccessibleAt: "2026-08-02T00:00:00.000Z",
  deleteAfter: "2026-08-03T00:00:00.000Z",
  deletedAt: null,
  statusUrl: `/api/account/cv-imports/${uploadId}`,
};

function context() {
  return { params: Promise.resolve({ uploadId }) };
}

function boundary() {
  return {
    authorize: vi.fn(async () => ({
      accountId: "account_consent_1234",
      sessionId: "session_consent_1234",
    })),
    readJson: vi.fn(async () => grantRequest),
  };
}

describe("CV external consent and deletion HTTP contract", () => {
  it("accepts only explicit true acceptance plus a server-issued challenge", () => {
    expect(cvConsentGrantRequestSchema.parse(grantRequest)).toEqual(
      grantRequest,
    );
    for (const forged of [
      { ...grantRequest, accepted: false },
      { ...grantRequest, provider: "openai" },
      { ...grantRequest, model: "browser-model" },
      { ...grantRequest, purposeVersion: "browser-purpose" },
      { ...grantRequest, noticeVersion: "browser-notice" },
      { ...grantRequest, consentTextVersion: "browser-text" },
      { ...grantRequest, accountId: "browser-owner" },
      { accepted: true },
    ]) {
      expect(cvConsentGrantRequestSchema.safeParse(forged).success).toBe(false);
    }
  });

  it("keeps the notice and outcomes exact, bounded, and content-free", () => {
    expect(
      cvConsentNoticeSchema.parse({
        required: true,
        granted: false,
        providerDisplayName: "OpenAI",
        processingPurpose: "Create a private CV review draft",
        noticeText: CV_EXTERNAL_CONSENT_NOTICE_TEXT,
        consentChallenge: challenge,
      }),
    ).toMatchObject({ required: true, granted: false });
    expect(
      cvConsentOutcomeSchema.parse({
        uploadId,
        grantedAt: "2026-08-02T00:00:00.000Z",
        status: "PARSE_QUEUED",
      }),
    ).not.toHaveProperty("consentEventId");
    expect(cvDeletionOutcomeSchema.parse(deletion)).toEqual(deletion);
    expect(JSON.stringify(deletion)).not.toMatch(
      /filename|digest|locator|draft|provider|model|consent/iu,
    );
  });

  it("defines bounded owner tombstones and never marks DELETED before cleanup", () => {
    const cancelled = {
      uploadId,
      status: "CANCELLED" as const,
      contentInaccessibleAt: deletion.contentInaccessibleAt,
      deleteAfter: deletion.deleteAfter,
      deletedAt: null,
    };
    expect(cvImportTombstoneSchema.parse(cancelled)).toEqual(cancelled);
    expect(cvImportStatusResponseSchema.parse(cancelled)).toEqual(cancelled);
    expect(
      cvImportTombstoneSchema.safeParse({ ...cancelled, status: "DELETED" })
        .success,
    ).toBe(false);
    expect(
      cvDeletionOutcomeSchema.safeParse({
        ...deletion,
        status: "DELETED",
        deletedAt: null,
        sourceBytes: "forbidden",
      }).success,
    ).toBe(false);
  });

  it("returns 201/204 no-store consent responses and an empty revoke body", async () => {
    const requestBoundary = boundary();
    const service = {
      grant: vi.fn(async () => ({
        uploadId,
        grantedAt: "2026-08-02T00:00:00.000Z",
        status: "PARSE_QUEUED" as const,
      })),
      revoke: vi.fn(async () => undefined),
    };
    const handlers = createCvConsentHandlers({
      boundary: requestBoundary,
      service,
    });
    const granted = await handlers.POST(
      new Request(
        `http://localhost/api/account/cv-imports/${uploadId}/consent`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(grantRequest),
        },
      ),
      context(),
    );
    expect(granted.status).toBe(201);
    expect(granted.headers.get("cache-control")).toMatch(/^no-store/u);
    expect(cvConsentOutcomeSchema.parse(await granted.json())).toMatchObject({
      uploadId,
    });

    const nextStyleEmptyBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const revoked = await handlers.DELETE(
      new Request(
        `http://localhost/api/account/cv-imports/${uploadId}/consent`,
        {
          method: "DELETE",
          body: nextStyleEmptyBody,
          duplex: "half",
        } as RequestInit & { duplex: "half" },
      ),
      context(),
    );
    expect(revoked.status).toBe(204);
    expect(revoked.headers.get("cache-control")).toMatch(/^no-store/u);
    expect(await revoked.text()).toBe("");
    expect(service.revoke).toHaveBeenCalledOnce();
  });

  it("returns an idempotent safe 202 deletion outcome and rejects delete bodies", async () => {
    const requestBoundary = boundary();
    const retention = { deleteOwnedImport: vi.fn(async () => deletion) };
    const handlers = createCvImportResourceHandlers({
      boundary: requestBoundary,
      retention,
      project: vi.fn(),
    });
    const accepted = await handlers.DELETE(
      new Request(`http://localhost/api/account/cv-imports/${uploadId}`, {
        method: "DELETE",
      }),
      context(),
    );
    expect(accepted.status).toBe(202);
    expect(accepted.headers.get("cache-control")).toMatch(/^no-store/u);
    expect(cvDeletionOutcomeSchema.parse(await accepted.json())).toEqual(
      deletion,
    );

    const rejected = await handlers.DELETE(
      new Request(`http://localhost/api/account/cv-imports/${uploadId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      context(),
    );
    expect(rejected.status).toBe(400);
    expect(retention.deleteOwnedImport).toHaveBeenCalledOnce();
  });

  it("keeps foreign and missing ownership responses generic", async () => {
    const requestBoundary = boundary();
    requestBoundary.authorize.mockRejectedValue(
      new CvRequestBoundaryError(404, "CV_IMPORT_NOT_FOUND"),
    );
    const handlers = createCvImportResourceHandlers({
      boundary: requestBoundary,
      retention: { deleteOwnedImport: vi.fn() },
      project: vi.fn(),
    });
    const response = await handlers.DELETE(
      new Request(`http://localhost/api/account/cv-imports/${uploadId}`, {
        method: "DELETE",
      }),
      context(),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(
      /foreign|owner|account_consent/iu,
    );
  });

  it("keeps OpenAPI aligned with challenge-only grant, no-store, tombstone, and lifecycle semantics", async () => {
    const openapi = await readFile(
      resolve(
        process.cwd(),
        "../spec-kit/specs/004-cv-upload-parse-review/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain(
      "operationId: grantOwnCvExternalProcessingConsent",
    );
    expect(openapi).toContain(
      "operationId: revokeOwnCvExternalProcessingConsent",
    );
    expect(openapi).toContain("operationId: deleteOwnCvImport");
    expect(openapi).toContain("CvImportTombstone:");
    expect(openapi).toContain("accepted:\n          const: true");
    expect(openapi).toContain('$ref: "#/components/headers/NoStoreHeader"');
    const requestSection = openapi.slice(
      openapi.indexOf("ConsentGrantRequest:"),
      openapi.indexOf("CvDeletionOutcome:"),
    );
    expect(requestSection).not.toMatch(
      /provider:|model:|purposeVersion:|noticeVersion:|consentTextVersion:|accountId:/u,
    );
  });
});
