import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const emptyPreparation = {
  data: {
    preparationId: null,
    version: 0,
    lookup: null,
    email: { status: "NONE" },
    draft: {},
  },
};
const unavailablePreparation = {
  data: {
    preparationId: "prep-manual",
    version: 1,
    lookup: {
      snapshotId: "snapshot-manual",
      taxIdentifier: "0316794479",
      outcome: "UNAVAILABLE",
      sourceLabel: "Registry unavailable",
      checkedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      facts: {
        legalName: null,
        registeredAddress: null,
        establishmentDate: null,
        legalStatus: null,
        entityType: null,
      },
    },
    email: { status: "NONE" },
    draft: {},
  },
};

describe("business registry section", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps later steps locked when the registry cannot confirm the identifier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body =
          url.endsWith("/registry-lookups") && init?.method === "POST"
            ? unavailablePreparation
            : url.endsWith("/preparation")
              ? emptyPreparation
              : { data: [] };
        return Response.json(body);
      }),
    );
    render(<EmployerVerificationPage />);
    await screen.findByRole("heading", { name: "Registered business" });
    const tax = document.querySelector<HTMLInputElement>(
      'input[name="taxIdentifier"]',
    );
    expect(tax).not.toBeNull();
    fireEvent.change(tax!, { target: { value: "0316794479" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up business" }));
    expect(
      await screen.findByText("Registry confirmation unavailable"),
    ).toBeVisible();
    expect(screen.getByText(/Registry unavailable/)).toBeVisible();
    expect(
      document.querySelector('input[name="applicantLegalName"]'),
    ).toBeNull();
    expect(
      screen.getByText(/before continuing to company details/i),
    ).toBeVisible();
    expect(toast.error).toHaveBeenCalled();
    expect(screen.getByText(/never auto-approves access/i)).toBeVisible();
  });

  it("locks a confirmed identifier and resets all progress before changing it", async () => {
    const confirmedPreparation = {
      data: {
        preparationId: "prep-confirmed",
        version: 2,
        lookup: {
          snapshotId: "snapshot-confirmed",
          taxIdentifier: "0316794479",
          outcome: "MATCHED",
          sourceLabel: "VietQR",
          checkedAt: "2026-08-14T00:00:00.000Z",
          expiresAt: "2026-08-15T00:00:00.000Z",
          facts: {
            legalName: "Example Company",
            registeredAddress: "Example address",
            establishmentDate: null,
            legalStatus: null,
            entityType: null,
          },
        },
        email: { status: "NONE" },
        draft: {
          applicantLegalName: "Example Company",
          applicantRegisteredAddress: "Example address",
        },
      },
    };
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/preparation") && init?.method === "DELETE") {
          return Response.json(emptyPreparation);
        }
        return Response.json(
          url.endsWith("/preparation") ? confirmedPreparation : { data: [] },
        );
      },
    );
    vi.stubGlobal("fetch", fetcher);

    render(<EmployerVerificationPage />);
    const tax = await screen.findByRole("textbox", {
      name: /Vietnamese tax identifier/u,
    });
    expect(tax).toHaveAttribute("readonly");
    expect(
      screen.getByRole("heading", { name: "Business information" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Change tax identifier" }),
    );

    await screen.findByRole("button", { name: "Look up business" });
    expect(tax).not.toHaveAttribute("readonly");
    expect(
      screen.queryByRole("heading", { name: "Business information" }),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/employer-verifications/preparation",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
