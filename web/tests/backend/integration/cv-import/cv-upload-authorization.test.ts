import { describe, expect, it } from "vitest";

import { CvImportServiceError } from "@/backend/services/cv-import/cv-http-errors";
import { GetCvImportStatusService } from "@/backend/services/cv-import/get-cv-import-status";

const ownerId = "account_owner_fixture";
const otherId = "account_other_fixture";

function service(accountState: "ACTIVE" | "SUSPENDED" = "ACTIVE") {
  return new GetCvImportStatusService({
    getAccountState: async (accountId) =>
      accountId === ownerId ? accountState : "ACTIVE",
    findOwned: async (accountId, uploadId) => {
      if (accountId !== ownerId || uploadId === "missing_upload") return null;
      if (uploadId === "forged_related") {
        return {
          uploadId,
          accountId,
          status: "REVIEW_READY" as const,
          draft: { id: "foreign_draft", accountId: otherId },
          parseJob: { id: "foreign_job", accountId: otherId },
        };
      }
      return {
        uploadId,
        accountId,
        status:
          uploadId === "deleted_upload"
            ? ("DELETED" as const)
            : ("SCAN_QUEUED" as const),
        draft: null,
        parseJob: null,
      };
    },
  });
}

describe("CV upload tenant authorization", () => {
  it("makes foreign, missing, and forged-related identifiers indistinguishable", async () => {
    for (const [accountId, uploadId] of [
      [otherId, "owned_upload"],
      [ownerId, "missing_upload"],
      [ownerId, "forged_related"],
    ] as const) {
      await expect(
        service().execute(accountId, uploadId),
      ).rejects.toMatchObject({
        code: "CV_IMPORT_NOT_FOUND",
      });
    }
  });

  it("separates inactive-account denial from session and object lookup", async () => {
    await expect(
      service("SUSPENDED").execute(ownerId, "owned_upload"),
    ).rejects.toEqual(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("returns only a content-free owner tombstone for terminal resources", async () => {
    const outcome = await service().execute(ownerId, "deleted_upload");
    expect(outcome).toEqual({ uploadId: "deleted_upload", status: "DELETED" });
    expect(JSON.stringify(outcome)).not.toMatch(
      /filename|sha|digest|locator|draft|provider|job/i,
    );
    expect(new CvImportServiceError("CV_IMPORT_NOT_FOUND")).toBeInstanceOf(
      Error,
    );
  });
});
