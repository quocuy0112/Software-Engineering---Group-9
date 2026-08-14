import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const preparation = {
  data: {
    preparationId: "prep-1",
    version: 2,
    lookup: {
      snapshotId: "snapshot-1",
      taxIdentifier: "0316794479",
      outcome: "MATCHED",
      sourceLabel: "VietQR",
      checkedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      facts: {
        legalName: "Example Company",
        registeredAddress: "123 Nguyen Hue, Ho Chi Minh City",
        establishmentDate: null,
        legalStatus: null,
        entityType: null,
      },
    },
    email: {
      status: "VERIFIED",
      maskedEmail: "hr***@example.vn",
      verifiedAt: "2026-08-14T01:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
    },
    draft: {
      applicantLegalName: "Example Company",
      applicantRegisteredAddress: "123 Nguyen Hue, Ho Chi Minh City",
      operatingAddressDiffers: false,
      operatingAddress: null,
      companyPhone: "+84901234567",
      website: "https://example.vn",
      relationship: "LEGAL_OWNER",
      currentJobTitle: "Owner",
      authorityExplanation: null,
      mismatchExplanation: null,
    },
  },
};

describe("employer verification submission UI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders four responsive sections and explicit trust limitations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(String(input).endsWith("/preparation") ? preparation : { data: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<EmployerVerificationPage />);
    for (const heading of [
      "Registered business",
      "Business information",
      "Company contact",
      "Your authority and evidence",
    ]) {
      expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    }
    expect(screen.getByText(/No OTP is performed; this phone is unverified/i)).toBeVisible();
    expect(screen.getByText(/never auto-approves access/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit recruiter application" })).toBeEnabled();
  });

  it("focuses the first invalid field before issuing a request", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) =>
      new Response(
        JSON.stringify(String(input).endsWith("/preparation") ? preparation : { data: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);
    const submit = await screen.findByRole("button", { name: "Submit recruiter application" });
    const firstInvalid = submit.closest("form")?.querySelector<HTMLElement>(":invalid");
    expect(firstInvalid).not.toBeNull();
    fireEvent.click(submit);
    await waitFor(() => expect(firstInvalid).toHaveFocus());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
