import { describe, expect, it } from "vitest";
import { exportDownloadResponse } from "@/backend/exports/export-download-response";

describe("export download response", () => {
  it.each([
    {
      format: "CSV",
      fileName: "candidates-job-1-export-1.csv",
      mediaType: "text/csv; charset=utf-8",
      body: Buffer.from("Application ID\r\napp-1\r\n", "utf8"),
    },
    {
      format: "XLSX",
      fileName: "candidates-job-1-export-2.xlsx",
      mediaType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    },
  ])("returns a browser-downloadable $format response", async (input) => {
    const response = exportDownloadResponse(input);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(input.mediaType);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="' + input.fileName + '"',
    );
    expect(response.headers.get("content-length")).toBe(
      String(input.body.byteLength),
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(input.body);
  });
});
