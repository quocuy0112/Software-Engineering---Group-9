import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountRecoveryCancellation } from "@/frontend/features/authentication/components/account-recovery-cancellation";
import { AccountRecoveryConfirmation } from "@/frontend/features/authentication/components/account-recovery-confirmation";

const { replace, toast } = vi.hoisted(() => ({
  replace: vi.fn(),
  toast: Object.assign(vi.fn(), {
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  replace.mockClear();
  toast.mockClear();
  toast.dismiss.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
  window.history.replaceState(null, "", "/");
});

describe("account recovery route capability UI", () => {
  it("exchanges the fragment proof, then requires explicit confirmation", async () => {
    const proof = "browser-route-proof".padEnd(40, "x");
    window.history.replaceState(
      null,
      "",
      `/account-recovery/confirm#proof=${proof}`,
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: "authorized" }))
      .mockResolvedValueOnce(
        Response.json(
          {
            message: "The 24-hour security hold has started.",
            holdEndsAt: "2026-07-28T10:00:00.000Z",
          },
          { status: 202 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountRecoveryConfirmation />);

    const button = await screen.findByRole("button", {
      name: "Start 24-hour security hold",
    });
    expect(window.location.hash).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/identity/account-recovery/capability",
    );
    expect(fetchMock.mock.calls[0][1]?.body).toContain(proof);

    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/identity/account-recovery/confirm",
    );
    expect(fetchMock.mock.calls[1][1]?.body).toBe("{}");
    expect(fetchMock.mock.calls[1][1]?.body).not.toContain(proof);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "The 24-hour security hold has started.",
        { id: "account-recovery-confirmation-status" },
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows a success toast when account recovery is cancelled", async () => {
    const proof = "browser-cancellation-proof".padEnd(40, "x");
    window.history.replaceState(
      null,
      "",
      `/account-recovery/cancel#proof=${proof}`,
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ status: "authorized" }))
      .mockResolvedValueOnce(
        Response.json({
          message:
            "Account recovery was cancelled. Sign in with your existing password and second factor.",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountRecoveryCancellation />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Cancel account recovery",
      }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Account recovery was cancelled. Sign in with your existing password and second factor.",
        { id: "account-recovery-cancellation-status" },
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Cancel account recovery" }),
    ).not.toBeInTheDocument();
  });

  it("redirects a direct route visit that has no fragment proof", async () => {
    window.history.replaceState(null, "", "/account-recovery/confirm");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AccountRecoveryConfirmation />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/account-recovery?invalidLink=1"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Start 24-hour security hold" }),
    ).not.toBeInTheDocument();
  });
});
