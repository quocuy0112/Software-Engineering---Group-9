import "server-only";

import { CvImportServiceError, cvContentFreeTombstone } from "./cv-http-errors";
import type { CvUploadStatus } from "@/shared/contracts/cv-import/common";

type StatusRow = Readonly<{
  uploadId: string;
  accountId: string;
  status: CvUploadStatus;
  draft: Readonly<{ id: string; accountId: string }> | null;
  parseJob: Readonly<{ id: string; accountId: string }> | null;
}>;

type Dependencies = Readonly<{
  getAccountState(accountId: string): Promise<string | null>;
  findOwned(accountId: string, uploadId: string): Promise<StatusRow | null>;
}>;

export class GetCvImportStatusService {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(accountId: string, uploadId: string) {
    if ((await this.dependencies.getAccountState(accountId)) !== "ACTIVE") {
      throw new CvImportServiceError("FORBIDDEN");
    }
    const row = await this.dependencies.findOwned(accountId, uploadId);
    if (
      !row ||
      row.accountId !== accountId ||
      (row.draft && row.draft.accountId !== accountId) ||
      (row.parseJob && row.parseJob.accountId !== accountId)
    ) {
      throw new CvImportServiceError("CV_IMPORT_NOT_FOUND");
    }
    if (["CANCELLED", "DELETED", "EXPIRED"].includes(row.status)) {
      return cvContentFreeTombstone({
        uploadId: row.uploadId,
        status: row.status as "CANCELLED" | "DELETED" | "EXPIRED",
      });
    }
    return Object.freeze({ uploadId: row.uploadId, status: row.status });
  }
}
