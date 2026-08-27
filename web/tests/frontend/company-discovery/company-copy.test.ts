import { describe, expect, it } from "vitest";
import { getCompanyCopy } from "@/frontend/features/candidate-company/i18n/company-copy";

describe("Candidate Company locale copy", () => {
  it("keeps the Company surface fully localized in English", () => {
    const copy = getCompanyCopy("en");

    expect(copy.searchCompanies).toBe("Search companies");
    expect(copy.paginationPage).toBe("Page");
    expect(copy.teamApplicationUnavailable).toBe(
      "Team applications are not currently available for this company.",
    );
  });

  it("keeps the Company surface fully localized in Vietnamese", () => {
    const copy = getCompanyCopy("vi");

    expect(copy.searchCompanies).toBe("Tìm kiếm công ty");
    expect(copy.companySearchPlaceholder).toBe(
      "Tên công ty, ngành hoặc địa điểm",
    );
    expect(copy.paginationPage).toBe("Trang");
    expect(copy.applyAs("Quản lý nhân sự")).toBe(
      "Ứng tuyển vị trí Quản lý nhân sự",
    );
    expect(copy.teamApplicationUnavailable).toBe(
      "Hiện chưa thể ứng tuyển vào đội ngũ của công ty này.",
    );
  });
});
