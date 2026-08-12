import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeLogoutAction } from "@/frontend/features/home/components/home-logout-action";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/frontend/features/authentication/client/current-csrf-proof", () => ({
  postWithCurrentCsrf: mocks.logout,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

const labels = {
  logout: "Log out",
  loggingOut: "Logging out…",
  logoutSuccess: "You have been logged out.",
  logoutError: "Could not log out. Please try again.",
};

describe("Home logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks duplicate submissions and requests a fresh guest presentation", async () => {
    let resolve!: (response: Response) => void;
    mocks.logout.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    render(<HomeLogoutAction csrfProof="proof" labels={labels} />);
    const button = screen.getByRole("button", { name: "Log out" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Logging out…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Logging out…" }));
    expect(mocks.logout).toHaveBeenCalledOnce();
    resolve(new Response(null, { status: 204 }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(screen.getByRole("status")).toHaveTextContent(labels.logoutSuccess);
  });

  it("keeps authenticated controls available after a localized failure", async () => {
    mocks.logout.mockResolvedValue(new Response(null, { status: 500 }));
    render(<HomeLogoutAction csrfProof="proof" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(labels.logoutError);
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("refreshes safely when the session has already expired", async () => {
    mocks.logout.mockResolvedValue(new Response(null, { status: 401 }));
    render(<HomeLogoutAction csrfProof="proof" labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
