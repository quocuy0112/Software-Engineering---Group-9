import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveJobAction } from "@/frontend/features/jobs/components/save-job-action";

afterEach(() => vi.unstubAllGlobals());

describe("save job action", () => {
  it("uses an ephemeral CSRF proof and reconciles to the server state", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfProof: "csrf-proof" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          saved: true,
          message: "Job saved.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<SaveJobAction jobId="job-1" initialSaved={false} />);

    fireEvent.click(screen.getByRole("button", { name: /save job/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /remove saved job/i }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/saved-jobs/job-1",
      expect.objectContaining({
        method: "PUT",
        headers: { "X-CSRF-Token": "csrf-proof" },
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/saved/i);
  });

  it("keeps the authoritative prior state and exposes a retryable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ csrfProof: "csrf-proof" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ message: "Try again." }),
        }),
    );
    render(<SaveJobAction jobId="job-1" initialSaved />);
    fireEvent.click(screen.getByRole("button", { name: /remove saved job/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/try again/i),
    );
    expect(
      screen.getByRole("button", { name: /remove saved job/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
