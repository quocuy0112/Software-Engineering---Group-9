import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const preparation = (status: "PENDING" | "VERIFIED") => ({
  data: {
    preparationId: "prep-contact",
    version: 2,
    lookup: {
      snapshotId: "snapshot-contact",
      taxIdentifier: "0316794479",
      outcome: "MATCHED",
      sourceLabel: "VietQR",
      checkedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      facts: { legalName: "Example Company", registeredAddress: "Example Address", establishmentDate: null, legalStatus: null, entityType: null },
    },
    email: {
      status,
      maskedEmail: "hr***@example.vn",
      expiresAt: "2026-08-15T00:00:00.000Z",
      verifiedAt: status === "VERIFIED" ? "2026-08-14T01:00:00.000Z" : null,
    },
    draft: {
      applicantLegalName: "Example Company",
      applicantRegisteredAddress: "Example Address",
      operatingAddressDiffers: false,
      companyPhone: "+84901234567",
      website: "https://example.vn",
      relationship: "LEGAL_OWNER",
      currentJobTitle: "Owner",
    },
  },
});

describe("company contact confirmation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
    vi.clearAllMocks();
  });

  it("removes the fragment immediately and renders verified/unverified labels", async () => {
    window.history.replaceState(null, "", "/dashboard/employer-verification#company-email-token=opaque-token-value-that-is-long-enough");
    let preparationReads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/company-email/confirm")) return Response.json({ status: "VERIFIED" });
      if (url.endsWith("/preparation")) {
        preparationReads += 1;
        return Response.json(preparation(preparationReads > 1 ? "VERIFIED" : "PENDING"));
      }
      return Response.json({ data: [] });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(await screen.findByText("Verified: hr***@example.vn")).toBeVisible();
    expect(screen.getByText(/this phone is unverified/i)).toBeVisible();
    expect(document.querySelector('input[name="website"]')).toHaveValue("https://example.vn");
    expect(toast.success).toHaveBeenCalledWith("Company email verified.", { id: "company-email" });
  });
});
