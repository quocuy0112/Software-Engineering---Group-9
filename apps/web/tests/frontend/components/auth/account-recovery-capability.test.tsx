import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountRecoveryConfirmation } from "@/frontend/features/authentication/components/auth/account-recovery-confirmation";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  replace.mockClear();
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
