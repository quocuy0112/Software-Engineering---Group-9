import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const emptyPreparation = {
  data: { preparationId: null, version: 0, lookup: null, email: { status: "NONE" }, draft: {} },
};
const manualPreparation = {
  data: {
    preparationId: "prep-manual",
    version: 1,
    lookup: {
      snapshotId: "snapshot-manual",
      taxIdentifier: "0316794479",
      outcome: "UNAVAILABLE",
      sourceLabel: "Manual fallback",
      checkedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      facts: { legalName: null, registeredAddress: null, establishmentDate: null, legalStatus: null, entityType: null },
    },
    email: { status: "NONE" },
    draft: {},
  },
};

describe("business registry section", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("restores an empty draft and opens deterministic manual fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = url.endsWith("/registry-lookups") && init?.method === "POST"
          ? manualPreparation
          : url.endsWith("/preparation")
            ? emptyPreparation
            : { data: [] };
        return Response.json(body);
      }),
    );
    render(<EmployerVerificationPage />);
    await screen.findByRole("heading", { name: "Registered business" });
    const tax = document.querySelector<HTMLInputElement>('input[name="taxIdentifier"]');
    expect(tax).not.toBeNull();
    fireEvent.change(tax!, { target: { value: "0316794479" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up business" }));
    expect(await screen.findByText("Registry confirmation unavailable")).toBeVisible();
    expect(screen.getByText(/Manual fallback/)).toBeVisible();
    expect(document.querySelector('input[name="applicantLegalName"]')).toBeVisible();
    expect(screen.getByText(/never auto-approves access/i)).toBeVisible();
  });
});
