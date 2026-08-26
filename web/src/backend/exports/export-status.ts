import "server-only";

import {
  exportStatusSchema,
  type ExportStatus,
} from "@/shared/contracts/analytics/exports";

type ExportRecord = {
  id: string;
  jobPostingId: string;
  format: "CSV" | "XLSX";
  status: "QUEUED" | "LEASED" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "DELETING" | "DELETED";
  requestedAt: Date;
  dataCutoff: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  rowCount: number | null;
  failureCode: string | null;
  storageLocator: string | null;
};

export function exportStatus(
  record: ExportRecord,
  now = new Date(),
): ExportStatus {
  const expired =
    record.status === "EXPIRED" ||
    record.status === "DELETED" ||
    (record.status === "SUCCEEDED" &&
      record.expiresAt !== null &&
      record.expiresAt <= now);
  const status =
    expired
      ? "EXPIRED"
      : record.status === "LEASED"
        ? "PROCESSING"
        : record.status === "DELETING" || record.status === "DELETED"
          ? "EXPIRED"
          : record.status;
  return exportStatusSchema.parse({
    id: record.id,
    jobId: record.jobPostingId,
    format: record.format,
    status,
    requestedAt: record.requestedAt.toISOString(),
    dataCutoff: record.dataCutoff.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    rowCount: record.rowCount,
    failureCode: record.failureCode,
    downloadAvailable:
      status === "SUCCEEDED" &&
      Boolean(record.storageLocator) &&
      record.expiresAt !== null &&
      record.expiresAt > now,
  });
}
