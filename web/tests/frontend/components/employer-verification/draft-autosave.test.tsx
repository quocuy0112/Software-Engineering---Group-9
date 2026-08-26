import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const basePreparation = {
  data: {
    preparationId: "prep-autosave",
    version: 2,
    lookup: {
      snapshotId: "snapshot-autosave",
      taxIdentifier: "0316794479",
      outcome: "MATCHED",
      sourceLabel: "VietQR",
      checkedAt: "2026-08-14T00:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
      facts: {
        legalName: "Example Company",
        registeredAddress: "Example registered address",
        establishmentDate: null,
        legalStatus: null,
        entityType: null,
      },
    },
    email: {
      status: "VERIFIED",
      maskedEmail: "j***@gmail.com",
      verifiedAt: "2026-08-14T01:00:00.000Z",
      expiresAt: "2026-08-15T00:00:00.000Z",
    },
    draft: {
      applicantLegalName: "Example Company",
      applicantRegisteredAddress: "Example registered address",
      operatingAddressDiffers: false,
      operatingAddress: null,
      companyPhone: "+84901234567",
      website: null,
      relationship: "LEGAL_OWNER",
      currentJobTitle: "Owner",
      authorityExplanation: null,
      mismatchExplanation: null,
      requestedRole: "RECRUITER",
    },
  },
};

describe("employer verification draft autosave", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("serializes rapid field saves using the latest server version", async () => {
    let serverVersion = 2;
    let serverDraft = { ...basePreparation.data.draft };
    const patchVersions: number[] = [];
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/preparation") && init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as {
            version: number;
            changes: Record<string, string | boolean | null>;
          };
          patchVersions.push(body.version);
          serverDraft = { ...serverDraft, ...body.changes };
          serverVersion += 1;
          return Response.json({
            data: {
              ...basePreparation.data,
              version: serverVersion,
              draft: serverDraft,
            },
          });
        }
        return Response.json(
          url.endsWith("/preparation") ? basePreparation : { data: [] },
        );
      },
    );
    vi.stubGlobal("fetch", fetcher);

    render(<EmployerVerificationPage />);
    const legalName = await screen.findByRole("textbox", {
      name: "Legal company name",
    });
    const address = screen.getByRole("textbox", { name: "Registered address" });

    fireEvent.change(legalName, { target: { value: "Updated Company" } });
    fireEvent.blur(legalName);
    fireEvent.change(address, {
      target: { value: "Updated registered address" },
    });
    fireEvent.blur(address);

    await waitFor(() => expect(patchVersions).toEqual([2, 3]));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("rejects a short explanation before sending PATCH", async () => {
    let patchCount = 0;
    const fetcher = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") patchCount += 1;
        return Response.json(
          String(input).endsWith("/preparation")
            ? basePreparation
            : { data: [] },
        );
      },
    );
    vi.stubGlobal("fetch", fetcher);

    render(<EmployerVerificationPage />);
    await screen.findByRole("heading", { name: "Business information" });
    const explanation = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="mismatchExplanation"]',
    );
    expect(explanation).not.toBeNull();
    fireEvent.change(explanation!, { target: { value: "Too short" } });
    fireEvent.blur(explanation!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Difference explanation must contain 20–500 characters when provided.",
        { id: "verification-draft-mismatchExplanation" },
      ),
    );
    expect(patchCount).toBe(0);
  });
});
