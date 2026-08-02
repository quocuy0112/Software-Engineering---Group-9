import { describe, expect, it } from "vitest";
import {
  decodeJobCursor,
  encodeJobCursor,
  normalizeSearchText,
} from "@/backend/services/jobs/search-normalization";

describe("Vietnamese job search normalization", () => {
  it.each([
    ["LẬP TRÌNH VIÊN", "lap trinh vien"],
    ["lập   trình-viên", "lap trinh vien"],
    ["Đà Nẵng", "da nang"],
    ["  TypeScript / React  ", "typescript react"],
  ])("normalizes %s deterministically", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it("bounds normalized search input", () => {
    expect(() => normalizeSearchText("x".repeat(201), 200)).toThrow(
      "JOB_SEARCH_TEXT_TOO_LONG",
    );
  });

  it("round-trips a versioned cursor", () => {
    const cursor = {
      v: 1 as const,
      sort: "NEWEST" as const,
      publishedAt: "2026-08-01T00:00:00.000Z",
      id: "job-1",
    };
    expect(decodeJobCursor(encodeJobCursor(cursor), "NEWEST")).toEqual(cursor);
  });

  it("rejects malformed and sort-mismatched cursors", () => {
    expect(() => decodeJobCursor("not-base64-json", "NEWEST")).toThrow(
      "JOB_SEARCH_CURSOR_INVALID",
    );
    const encoded = encodeJobCursor({
      v: 1,
      sort: "NEWEST",
      publishedAt: "2026-08-01T00:00:00.000Z",
      id: "job-1",
    });
    expect(() => decodeJobCursor(encoded, "RELEVANCE")).toThrow(
      "JOB_SEARCH_CURSOR_INVALID",
    );
  });
});
