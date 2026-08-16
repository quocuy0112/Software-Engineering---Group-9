import { describe, expect, it } from "vitest";
import { decodeRankingCursor, encodeRankingCursor } from "@/backend/scoring/pagination/ranking-cursor";

const cursor = { v: 1 as const, jobId: "job-1", snapshotId: "snapshot-1", filterHash: "filter-1", sort: "FINAL_SCORE", pageSize: 25, position: 25, scoreKey: 90.4, submittedAt: "2026-08-15T00:00:00.000Z", applicationId: "app-25" };

describe("ranking cursor binding", () => {
  it("round-trips and rejects job/filter/page-size changes", () => {
    const encoded = encodeRankingCursor(cursor);
    expect(decodeRankingCursor(encoded, { jobId: "job-1", filterHash: "filter-1", sort: "FINAL_SCORE", pageSize: 25 })).toMatchObject(cursor);
    expect(decodeRankingCursor(encoded, { jobId: "job-2", filterHash: "filter-1", sort: "FINAL_SCORE", pageSize: 25 })).toBeNull();
    expect(decodeRankingCursor(encoded, { jobId: "job-1", filterHash: "filter-1", sort: "FINAL_SCORE", pageSize: 100 })).toBeNull();
  });

  it("rejects tampering without throwing", () => {
    const encoded = encodeRankingCursor(cursor);
    const tampered = encoded.slice(0, -1) + (encoded.endsWith("a") ? "b" : "a");
    expect(decodeRankingCursor(tampered, { jobId: "job-1", filterHash: "filter-1", sort: "FINAL_SCORE", pageSize: 25 })).toBeNull();
  });
});
