import { describe, expect, it } from "vitest";
import { splitCompanyIdentity } from "@/shared/contracts/employer-verification/business-verification";

describe("splitCompanyIdentity", () => {
  it("separates an explicit Vietnamese entity-type suffix", () => {
    expect(
      splitCompanyIdentity(
        "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (LOẠI HÌNH DOANH NGHIỆP: CÔNG TY TNHH)",
      ),
    ).toEqual({
      name: "TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM",
      entityType: "CÔNG TY TNHH",
    });
  });

  it("preserves a normal legal prefix that is part of the registered name", () => {
    expect(splitCompanyIdentity("CÔNG TY TNHH CASSO")).toEqual({
      name: "CÔNG TY TNHH CASSO",
      entityType: null,
    });
  });

  it("prefers an authoritative entity type supplied separately", () => {
    expect(
      splitCompanyIdentity(
        "Northstar Labs (BUSINESS ENTITY TYPE: Joint stock company)",
        "Company limited by shares",
      ),
    ).toEqual({
      name: "Northstar Labs",
      entityType: "Company limited by shares",
    });
  });
});
