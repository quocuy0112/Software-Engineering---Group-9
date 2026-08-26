import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployerVerificationPage } from "@/frontend/features/employer-verification/employer-verification-page";

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("sonner", () => ({ toast }));

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
      requestedRole: "RECRUITER",
    },
  },
};

describe("employer verification submission UI", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders four responsive sections and explicit trust limitations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify(
              String(input).endsWith("/preparation")
                ? preparation
                : { data: [] },
            ),
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
      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeVisible();
    }
    expect(
      screen.getByText(/No OTP is performed; this phone is unverified/i),
    ).toBeVisible();
    expect(screen.getByText(/never auto-approves access/i)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Submit recruiter application" }),
    ).toBeEnabled();
  });

  it("restores the requested role from the recoverable preparation draft", async () => {
    const savedPreparation = {
      data: {
        ...preparation.data,
        draft: { ...preparation.data.draft, requestedRole: "OWNER" },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        Response.json(
          String(input).endsWith("/preparation")
            ? savedPreparation
            : { data: [] },
        ),
      ),
    );
    render(<EmployerVerificationPage />);
    expect(
      await screen.findByRole("combobox", { name: "Requested role" }),
    ).toHaveValue("OWNER");
  });

  it("focuses the first invalid field before issuing a request", async () => {
    const fetcher = vi.fn(
      async (input: RequestInfo | URL) =>
        new Response(
          JSON.stringify(
            String(input).endsWith("/preparation") ? preparation : { data: [] },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);
    const submit = await screen.findByRole("button", {
      name: "Submit recruiter application",
    });
    const firstInvalid = submit
      .closest("form")
      ?.querySelector<HTMLElement>(":invalid");
    expect(firstInvalid).not.toBeNull();
    fireEvent.click(submit);
    await waitFor(() => expect(firstInvalid).toHaveFocus());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("waits for the latest draft version before submitting", async () => {
    let releasePatch!: (response: Response) => void;
    const pendingPatch = new Promise<Response>((resolve) => {
      releasePatch = resolve;
    });
    let submittedBody: FormData | null = null;
    const latestPreparation = {
      data: {
        ...preparation.data,
        version: 4,
        draft: {
          ...preparation.data.draft,
          requestedRole: "OWNER",
          applicantLegalName: "Updated Company",
        },
      },
    };
    const rolePreparation = {
      data: {
        ...preparation.data,
        version: 3,
        draft: { ...preparation.data.draft, requestedRole: "OWNER" },
      },
    };
    const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/preparation") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as {
          changes?: Record<string, unknown>;
        };
        return body.changes?.requestedRole === "OWNER"
          ? Promise.resolve(Response.json(rolePreparation))
          : pendingPatch;
      }
      if (url.endsWith("/employer-verifications") && init?.method === "POST") {
        submittedBody = init.body as FormData;
        return Promise.resolve(
          Response.json({ requestId: "request-1", state: "PENDING_CHECKS" }),
        );
      }
      if (url.endsWith("/preparation"))
        return Promise.resolve(Response.json(preparation));
      return Promise.resolve(Response.json({ data: [] }));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);
    const validity = vi
      .spyOn(HTMLFormElement.prototype, "checkValidity")
      .mockReturnValue(true);

    const legalName = await screen.findByRole("textbox", {
      name: "Legal company name",
    });
    fireEvent.change(
      await screen.findByRole("combobox", { name: "Requested role" }),
      { target: { value: "OWNER" } },
    );
    fireEvent.change(legalName, { target: { value: "Updated Company" } });
    fireEvent.blur(legalName);
    fireEvent.click(
      screen.getByRole("button", { name: "Submit recruiter application" }),
    );

    await waitFor(() =>
      expect(
        fetcher.mock.calls.filter(
          ([url, request]) =>
            String(url).endsWith("/preparation") && request?.method === "PATCH",
        ),
      ).toHaveLength(2),
    );
    expect(
      fetcher.mock.calls.some(
        ([url, request]) =>
          String(url).endsWith("/employer-verifications") &&
          request?.method === "POST",
      ),
    ).toBe(false);

    await act(async () => {
      releasePatch(Response.json(latestPreparation));
    });
    await waitFor(() => expect(submittedBody).not.toBeNull());
    const capturedBody = submittedBody as unknown as FormData;
    expect(capturedBody.get("preparationVersion")).toBe("4");
    expect(capturedBody.get("preparationId")).toBe("prep-1");
    expect(capturedBody.get("requestedRole")).toBe("OWNER");
    expect(toast.error).not.toHaveBeenCalled();
    validity.mockRestore();
  });

  it("sends replacement evidence only once when the form is submitted twice", async () => {
    let finishResubmit!: (response: Response) => void;
    let resubmitted = false;
    const pendingResponse = new Promise<Response>((resolve) => {
      finishResubmit = resolve;
    });
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resubmit")) return pendingResponse;
      if (url.endsWith("/preparation"))
        return Promise.resolve(
          new Response(JSON.stringify(preparation), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "request-1",
                submittedCompanyName: "Example Company",
                normalizedTaxIdentifier: "0316794479",
                requestedRole: "RECRUITER",
                state: resubmitted ? "PENDING_CHECKS" : "CHANGES_REQUESTED",
                resubmissionCount: resubmitted ? 1 : 0,
                createdAt: "2026-08-14T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);

    const submit = await screen.findByRole("button", {
      name: "Resubmit evidence",
    });
    const form = submit.closest("form");
    expect(form).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Replacement business license"), {
      target: {
        files: [
          new File(["evidence"], "license.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        fetcher.mock.calls.filter(([url]) => String(url).endsWith("/resubmit")),
      ).toHaveLength(1);
    });

    resubmitted = true;
    await act(async () => {
      finishResubmit(
        new Response(
          JSON.stringify({ requestId: "request-1", state: "PENDING_CHECKS" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    expect(await screen.findByText("Safety checks")).toBeVisible();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("recognizes an already accepted replacement after a stale duplicate response", async () => {
    let requestReads = 0;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/resubmit"))
        return new Response(JSON.stringify({ code: "TARGET_UNAVAILABLE" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/preparation"))
        return new Response(JSON.stringify(preparation), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      requestReads += 1;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "request-1",
              submittedCompanyName: "Example Company",
              normalizedTaxIdentifier: "0316794479",
              requestedRole: "RECRUITER",
              state:
                requestReads === 1 ? "CHANGES_REQUESTED" : "PENDING_REVIEW",
              resubmissionCount: requestReads === 1 ? 0 : 1,
              createdAt: "2026-08-14T00:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    render(<EmployerVerificationPage />);

    const submit = await screen.findByRole("button", {
      name: "Resubmit evidence",
    });
    fireEvent.change(screen.getByLabelText("Replacement business license"), {
      target: {
        files: [
          new File(["evidence"], "license.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.submit(submit.closest("form")!);

    expect(await screen.findByText("Under review")).toBeVisible();
    expect(toast.success).toHaveBeenCalledWith(
      "Replacement evidence was already received and is under review.",
    );
    expect(toast.error).not.toHaveBeenCalled();
  });
});
