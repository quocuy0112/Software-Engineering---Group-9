import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          entityType: "Limited liability company",
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

  it("renders verified identity as locked display-only data", () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    render(
      createElement(CompanySettingsScreen, {
        initialCompany: {
          id: "company-1",
          slug: "dava",
          name: "Dava",
          entityType: "Limited liability company",
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
          profileComplete: true,
          missingProfileFields: [],
        },
      }),
    );

    expect(screen.getByText("Verified identity")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("Limited liability company")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Company name" }),
    ).not.toBeInTheDocument();
  });

  it("returns to read-only mode after saving and opens editing on demand", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const savedCompany = {
      id: "company-1",
      slug: "dava",
      name: "Dava",
      entityType: "Limited liability company",
      industry: "FinTech",
      size: "1-50 employees",
      address: "Ho Chi Minh, District 8",
      logo: "https://example.com/dava-logo.png",
      website: "https://example.com/Dava",
      description: "A verified SmartHire employer.",
      ownerUserId: "recruiter-1",
      memberUserIds: [],
      taxCode: "1234567890",
      verificationStatus: "approved" as const,
      profileComplete: true,
      missingProfileFields: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => savedCompany,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      createElement(CompanySettingsScreen, {
        initialCompany: savedCompany,
      }),
    );

    expect(
      screen.queryByRole("textbox", { name: "Industry *" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Edit company profile" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Industry *" }), {
      target: { value: "FinTech" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save company profile" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("textbox", { name: "Industry *" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Your public company information"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("auto-expands the description field as its content grows", () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);

    render(
      createElement(CompanySettingsScreen, {
        initialCompany: {
          id: "company-1",
          slug: "dava",
          name: "Dava",
          entityType: "Limited liability company",
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
          profileComplete: true,
          missingProfileFields: [],
        },
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Edit company profile" }),
    );
    const description = screen.getByRole("textbox", { name: "Description" });
    Object.defineProperty(description, "scrollHeight", {
      configurable: true,
      value: 240,
    });

    fireEvent.change(description, {
      target: {
        value:
          "A longer company description that should expand vertically as the recruiter types more content.",
      },
    });

    expect(description).toHaveStyle({ height: "240px" });
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
