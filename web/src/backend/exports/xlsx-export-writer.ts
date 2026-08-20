import "server-only";

import ExcelJS from "exceljs";
import {
  candidateExportHeaders,
  type CandidateExportRow,
} from "@/shared/contracts/analytics/exports";
import { normalizeExportCell } from "./export-cell-policy";

export async function writeCandidateXlsx(
  rows: readonly CandidateExportRow[],
  metadata: Readonly<Record<string, string>>,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SmartHire";
  workbook.created = new Date();
  const candidates = workbook.addWorksheet("Candidates");
  candidates.addRow([...candidateExportHeaders]);
  for (const row of rows) {
    const output = [
      row.applicationId,
      row.candidateName,
      row.email,
      row.phone,
      row.applicationStatus,
      row.cvScreeningScore,
      row.scoreAvailability,
      row.submittedAt,
    ].map(normalizeExportCell);
    const sheetRow = candidates.addRow(output);
    sheetRow.eachCell((cell) => {
      cell.numFmt = "@";
    });
  }
  candidates.getRow(1).font = { bold: true };
  candidates.views = [{ state: "frozen", ySplit: 1 }];
  candidates.autoFilter = {
    from: "A1",
    to: "H" + Math.max(1, rows.length + 1),
  };
  candidates.columns = candidateExportHeaders.map((header) => ({
    header,
    key: header,
    width: Math.max(16, Math.min(40, header.length + 4)),
  }));

  const metadataSheet = workbook.addWorksheet("Metadata");
  metadataSheet.addRow(["Field", "Value"]);
  for (const [key, value] of Object.entries(metadata)) {
    metadataSheet.addRow([normalizeExportCell(key), normalizeExportCell(value)]);
  }
  metadataSheet.getRow(1).font = { bold: true };
  metadataSheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 64 },
  ];
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
