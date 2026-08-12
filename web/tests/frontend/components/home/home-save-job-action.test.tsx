import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeSaveJobAction } from "@/frontend/features/home/components/home-save-job-action";
import { safeHomeLoginHref } from "@/frontend/features/home/components/home-auth-required-feedback";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/frontend/features/authentication/client/current-csrf-proof", () => ({
  mutateWithCurrentCsrf: mocks.mutate,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

describe("Home save job", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands guests to login with only an allowlisted job-detail return path", () => {
    render(<HomeSaveJobAction jobId="job-1" slug="frontend-intern" initialSaved={false} locale="en" />);
    expect(screen.getByRole("link", { name: "Log in to save this job" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fjobs%2Ffrontend-intern",
    );
    expect(safeHomeLoginHref("//evil.example/steal")).toBe("/login?returnTo=%2Fjobs");
    expect(safeHomeLoginHref("/jobs/good?token=secret")).toBe("/login?returnTo=%2Fjobs");
  });

  it("blocks duplicates and announces a successful optimistic save", async () => {
    let resolve!: (response: Response) => void;
    mocks.mutate.mockReturnValue(new Promise<Response>((done) => { resolve = done; }));
    render(<HomeSaveJobAction jobId="job-1" slug="frontend-intern" initialSaved={false} csrfProof="proof" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Save job" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(mocks.mutate).toHaveBeenCalledOnce();
    resolve(new Response(null, { status: 204 }));
    expect(await screen.findByRole("status")).toHaveTextContent("Job saved.");
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back on failure and resets private presentation on expiry", async () => {
    mocks.mutate.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { unmount } = render(<HomeSaveJobAction jobId="job-1" slug="frontend-intern" initialSaved={false} csrfProof="proof" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Save job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update saved jobs");
    expect(screen.getByRole("button", { name: "Save job" })).toHaveAttribute("aria-pressed", "false");
    unmount();

    mocks.mutate.mockResolvedValueOnce(new Response(null, { status: 401 }));
    render(<HomeSaveJobAction jobId="job-1" slug="frontend-intern" initialSaved csrfProof="proof" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });
});
