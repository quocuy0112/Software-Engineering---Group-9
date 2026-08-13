import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import {
  CompanySettingsScreen,
  getCompanyProfileValidation,
} from "@/frontend/features/recruiter-workspace/company-settings-screen";

vi.mock("@/frontend/features/authentication/client/csrf-proof-context", () => ({
  useCsrfProof: () => "csrf-test-proof",
}));

describe("company posting gate validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("does not show a stale posting gate for a filled company form", () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    render(
      createElement(CompanySettingsScreen, {
        initialCompany: {
          id: "company-1",
          slug: "dava",
          name: "Dava",
          industry: "Game Development",
          size: "1-50 employees",
          address: "Ho Chi Minh, District 8",
          logo: "https://example.com/dava-logo.png",
          website: "https://example.com/Dava",
          description: "A verified SmartHire employer.",
          ownerUserId: "recruiter-1",
          memberUserIds: [],
          taxCode: "1234567890",
          verificationStatus: "approved",
          profileComplete: false,
          missingProfileFields: ["industry", "size", "address", "logo"],
        },
      }),
    );

    expect(
      screen.queryByRole("heading", {
        name: "Complete your company profile before posting a job",
      }),
    ).not.toBeInTheDocument();
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
