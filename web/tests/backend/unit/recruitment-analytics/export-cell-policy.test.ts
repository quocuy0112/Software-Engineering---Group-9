import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  csvCell,
  normalizeExportCell,
  writeCandidateCsv,
  writeCandidateXlsx,
} from "@/backend/exports";

describe("candidate export cell policy", () => {
  it("neutralizes spreadsheet formulas after whitespace", () => {
    expect(normalizeExportCell("  =1+1")).toBe("'  =1+1");
    const value = ["A,B", "C"].join(String.fromCharCode(10));
    const quoted = String.fromCharCode(34) + value + String.fromCharCode(34);
    expect(csvCell(value)).toBe(quoted);
  });

  it("emits a header-only UTF-8 CSV when there are no candidates", () => {
    const content = writeCandidateCsv([]);
    expect(content.toString("utf8")).toContain("Application ID,Candidate Name");
    expect(content.toString("utf8").split(String.fromCharCode(13, 10))).toHaveLength(2);
  });

  it("writes the fixed candidate and metadata worksheets for XLSX", async () => {
    const content = await writeCandidateXlsx(
      [
        {
          applicationId: "application-1",
          candidateName: "Candidate",
          email: "candidate@example.test",
          phone: "+84123456789",
          applicationStatus: "INTERVIEWING",
          cvScreeningScore: "88.50",
          scoreAvailability: "AVAILABLE",
          submittedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      { Definition: "recruitment-analytics-v1" },
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as unknown as ArrayBuffer);
    expect(workbook.getWorksheet("Candidates")?.getRow(1).values).toEqual([
      undefined,
      "Application ID",
      "Candidate Name",
      "Email",
      "Phone",
      "Application Status",
      "CV Screening Score",
      "Score Availability",
      "Submitted At",
    ]);
    expect(workbook.getWorksheet("Metadata")?.getCell("A2").value).toBe(
      "Definition",
    );
  });
});
