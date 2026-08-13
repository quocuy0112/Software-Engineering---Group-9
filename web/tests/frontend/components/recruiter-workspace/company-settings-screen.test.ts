import { describe, expect, it, vi } from "vitest";
import { getCompanyProfileValidation } from "@/frontend/features/recruiter-workspace/company-settings-screen";

describe("company posting gate validation", () => {
  it("recomputes completeness from filled form values instead of a stale server snapshot", () => {
    const validation = getCompanyProfileValidation({
      name: "Dava",
      industry: "Game Development",
      size: "1-50 employees",
      address: "Ho Chi Minh, District 8",
      logo: "https://example.com/dava-logo.png",
      website: "https://example.com/Dava",
      description: "A verified SmartHire employer.",
    });

    expect(validation).toEqual({
      missingFields: [],
      fieldErrors: {},
    });
  });

  it("returns field-specific reasons for incomplete profile values", () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    const validation = getCompanyProfileValidation({
      name: "Dava",
      industry: "",
      size: "1-50 employees",
      address: "Ho Chi Minh, District 8",
      logo: null,
      website: null,
      description: null,
    });

    expect(validation.missingFields).toEqual(["industry", "logo"]);
    expect(validation.fieldErrors).toEqual({
      industry: "Industry is required.",
      logo: "Company logo is required.",
    });
  });
});
