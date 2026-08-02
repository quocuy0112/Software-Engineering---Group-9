import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CvAccountRequestBoundary } from "@/backend/security/cv-account-request-boundary";
import {
  CV_DRAFT_PAYLOAD_MAX_BYTES,
  CV_PROVENANCE_PAYLOAD_MAX_BYTES,
  CV_SAVE_DRAFT_REQUEST_MAX_BYTES,
  assertReviewPayloadCaps,
  confirmCvDraftRequestSchema,
  cvConfirmationReceiptSchema,
  cvDraftComparisonSchema,
  saveCvDraftRequestSchema,
} from "@/shared/contracts/cv-import/review";
import {
  canonicalJsonBytes,
  cvApiErrorSchema,
} from "@/shared/contracts/cv-import/common";

const evidence = {
  confidence: null,
  locations: [],
  contextAvailable: false,
  context: null,
};
const proposals = {
  scalars: [
    {
      proposalId: "proposal_headline_fixture",
      field: "headline",
      value: "Platform Engineer",
      evidence,
    },
  ],
  experiences: [],
  education: [],
  skills: [],
  socialLinks: [],
} as const;
const reviewDecisions = {
  reviewComplete: true,
  scalars: [{ proposalId: "proposal_headline_fixture", action: "ADD" }],
  experiences: [],
  education: [],
  skills: [],
  socialLinks: [],
} as const;

describe("CV draft review contract", () => {
  it("keeps editable review and provenance caps independent at their exact boundaries", () => {
    const decisions = {};
    const emptyDocumentBytes = canonicalJsonBytes({ padding: "" });
    const editable = {
      padding: "x".repeat(
        CV_DRAFT_PAYLOAD_MAX_BYTES -
          canonicalJsonBytes(decisions) -
          emptyDocumentBytes,
      ),
    };
    const provenance = {
      padding: "x".repeat(CV_PROVENANCE_PAYLOAD_MAX_BYTES - emptyDocumentBytes),
    };
    expect(() =>
      assertReviewPayloadCaps({
        proposals: editable,
        decisions,
        provenance,
      }),
    ).not.toThrow();
    expect(() =>
      assertReviewPayloadCaps({
        proposals: { ...editable, padding: `${editable.padding}x` },
        decisions,
        provenance,
      }),
    ).toThrow("CV_DRAFT_PAYLOAD_LIMIT_EXCEEDED");
    expect(() =>
      assertReviewPayloadCaps({
        proposals: editable,
        decisions,
        provenance: { ...provenance, padding: `${provenance.padding}x` },
      }),
    ).toThrow("CV_PROVENANCE_LIMIT_EXCEEDED");
  });

  it("accepts a valid save document at the combined transport bound and rejects one byte over", async () => {
    const value = {
      baseDraftRevision: 0,
      reviewedProfileRevision: 0,
      proposals,
      reviewDecisions,
    };
    const serialized = JSON.stringify(value);
    const serializedBytes = new TextEncoder().encode(serialized).byteLength;
    const atBoundary =
      serialized +
      " ".repeat(CV_SAVE_DRAFT_REQUEST_MAX_BYTES - serializedBytes);
    const boundary = new CvAccountRequestBoundary();
    const request = (body: string) =>
      new Request("https://smarthire.example/api/account/cv-drafts/example", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "content-length": String(new TextEncoder().encode(body).byteLength),
        },
        body,
      });
    await expect(
      boundary.readJson(
        request(atBoundary),
        saveCvDraftRequestSchema,
        CV_SAVE_DRAFT_REQUEST_MAX_BYTES,
      ),
    ).resolves.toEqual(value);
    await expect(
      boundary.readJson(
        request(`${atBoundary} `),
        saveCvDraftRequestSchema,
        CV_SAVE_DRAFT_REQUEST_MAX_BYTES,
      ),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("accepts only complete bounded comparison/save/confirm shapes", () => {
    expect(
      saveCvDraftRequestSchema.parse({
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals,
        reviewDecisions,
      }),
    ).toBeTruthy();
    expect(
      confirmCvDraftRequestSchema.parse({
        draftRevision: 1,
        sourceProfileRevision: 0,
        reviewedProfileRevision: 0,
      }),
    ).toBeTruthy();
    expect(
      saveCvDraftRequestSchema.safeParse({
        baseDraftRevision: 0,
        reviewedProfileRevision: 0,
        proposals,
        reviewDecisions,
        rawText: "forbidden",
      }).success,
    ).toBe(false);
  });

  it("makes missing provenance explicit without fabricating context", () => {
    const comparison = cvDraftComparisonSchema.safeParse({
      draftId: "draft_fixture_1234",
      uploadId: "upload_fixture_1234",
      draftRevision: 0,
      sourceProfileRevision: 0,
      reviewedProfileRevision: 0,
      currentProfile: {
        revision: 0,
        headline: null,
        summary: null,
        phone: null,
        location: null,
        experiences: [],
        education: [],
        skills: [],
        socialLinks: [],
      },
      proposals,
      reviewDecisions,
      expiresAt: "2026-08-31T08:00:00.000Z",
    });
    expect(comparison.success).toBe(true);
    expect(proposals.scalars[0].evidence).toEqual(evidence);
  });

  it("keeps OpenAPI review responses no-store and content-safe", async () => {
    const openapi = await readFile(
      resolve(
        process.cwd(),
        "../spec-kit/specs/004-cv-upload-parse-review/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("operationId: getOwnCvDraftComparison");
    expect(openapi).toContain("operationId: saveOwnCvDraftReview");
    expect(openapi).toContain("operationId: confirmOwnCvDraft");
    expect(openapi).toContain('$ref: "#/components/headers/NoStoreHeader"');
    expect(openapi).not.toMatch(/rawText|sourceSnippet/u);
  });

  it("keeps receipts/conflicts content-free and binds confirm idempotency", async () => {
    const receipt = {
      receiptId: "receipt_fixture_1234",
      uploadId: "upload_fixture_1234",
      draftId: "draft_fixture_1234",
      confirmedAt: "2026-08-01T08:00:00.000Z",
      draftRevision: 1,
      sourceProfileRevision: 0,
      reviewedProfileRevision: 0,
      profileRevisionBefore: 0,
      profileRevisionAfter: 1,
      appliedCounts: {
        scalars: 1,
        experiences: 0,
        education: 0,
        skills: 0,
        socialLinks: 0,
      },
    };
    expect(cvConfirmationReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(
      cvConfirmationReceiptSchema.safeParse({ ...receipt, rawText: "no" })
        .success,
    ).toBe(false);
    expect(
      cvApiErrorSchema.parse({
        error: {
          code: "DRAFT_REVISION_CONFLICT",
          message: "Reload the review.",
          requestId: "request_fixture_1234",
          fieldErrors: [],
          latest: {
            draftRevision: 2,
            profileRevision: 1,
            draftUpdatedAt: "2026-08-01T08:10:00.000Z",
            profileUpdatedAt: "2026-08-01T08:05:00.000Z",
          },
        },
      }).error.latest,
    ).toEqual({
      draftRevision: 2,
      profileRevision: 1,
      draftUpdatedAt: "2026-08-01T08:10:00.000Z",
      profileUpdatedAt: "2026-08-01T08:05:00.000Z",
    });
    const route = await readFile(
      resolve(
        process.cwd(),
        "src/app/api/account/cv-drafts/[draftId]/confirm/route.ts",
      ),
      "utf8",
    );
    const service = await readFile(
      resolve(
        process.cwd(),
        "src/backend/services/cv-import/confirm-cv-draft.ts",
      ),
      "utf8",
    );
    expect(route).toContain('request.headers.get("idempotency-key")');
    expect(service).toContain("smarthire:cv-confirm:idempotency:v1");
  });
});
