import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyEmailVerificationLanding } from "@/frontend/features/employer-verification/company-email-verification-landing";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const token = "company-email-verification-token-value-1234567890";

describe("company email verification landing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("removes the fragment, confirms the token, and returns to the form", async () => {
    window.history.replaceState(
      null,
      "",
      `/verify-company-email#company-email-token=${token}`,
    );
    const fetcher = vi.fn(async () => Response.json({ status: "VERIFIED" }));
    vi.stubGlobal("fetch", fetcher);

    render(<CompanyEmailVerificationLanding />);

    await waitFor(() => expect(window.location.hash).toBe(""));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/dashboard/employer-verification?companyEmailVerified=1",
      ),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/employer-verifications/company-email/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    );
  });

  it("keeps a signed-out token only in memory for retry", async () => {
    window.history.replaceState(
      null,
      "",
      `/verify-company-email#company-email-token=${token}`,
    );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ code: "UNAUTHORIZED" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ status: "VERIFIED" }));
    vi.stubGlobal("fetch", fetcher);

    render(<CompanyEmailVerificationLanding />);

    expect(await screen.findByText(/Sign in as the Candidate/i)).toBeVisible();
    expect(window.location.hash).toBe("");
    expect(screen.getByRole("link", { name: /Open sign in/i })).toHaveAttribute(
      "target",
      "_blank",
    );

    fireEvent.click(screen.getByRole("button", { name: /Retry verification/i }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
  });

  it("rejects a missing fragment without calling the API", async () => {
    window.history.replaceState(null, "", "/verify-company-email");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    render(<CompanyEmailVerificationLanding />);

    expect(await screen.findByText(/invalid, expired, already used/i)).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
