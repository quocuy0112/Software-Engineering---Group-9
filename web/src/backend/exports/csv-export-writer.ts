import "server-only";

import {
  candidateExportHeaders,
  type CandidateExportRow,
} from "@/shared/contracts/analytics/exports";
import { csvCell } from "./export-cell-policy";

export function writeCandidateCsv(rows: readonly CandidateExportRow[]) {
  const header = candidateExportHeaders.map(csvCell).join(",");
  const body = rows.map((row) =>
    [
      row.applicationId,
      row.candidateName,
      row.email,
      row.phone,
      row.applicationStatus,
      row.cvScreeningScore,
      row.scoreAvailability,
      row.submittedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return Buffer.from([header, ...body].join("\r\n") + "\r\n", "utf8");
}
