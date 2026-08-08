import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CsrfProofProvider } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  JobInteractionProvider,
  useOptionalJobInteraction,
} from "@/frontend/features/jobs/components/job-interaction-provider";
import { SaveJobAction } from "@/frontend/features/jobs/components/save-job-action";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ProviderUpdateProbe() {
  const interaction = useOptionalJobInteraction();
  const presetCount = interaction?.savedFilterPresets.length ?? 0;
  const saveFilterPreset = interaction?.saveFilterPreset;

  useEffect(() => {
    if (!saveFilterPreset || presetCount >= 4) return;
    saveFilterPreset("Preset " + presetCount, {});
  }, [presetCount, saveFilterPreset]);

  return <output data-testid="preset-count">{presetCount}</output>;
}

describe("save job action", () => {
  it("registers a page of jobs without entering a provider update loop", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          savedJobIds: ["job-1"],
          hiddenJobIds: [],
        }),
      }),
    );

    render(
      <StrictMode>
        <CsrfProofProvider value="csrf-proof">
          <JobInteractionProvider>
            <ProviderUpdateProbe />
            {Array.from({ length: 20 }, (_, index) => (
              <SaveJobAction
                key={index}
                jobId={"job-" + (index + 1)}
                initialSaved={false}
              />
            ))}
          </JobInteractionProvider>
        </CsrfProofProvider>
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button")[0]).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(screen.getByTestId("preset-count")).toHaveTextContent("4");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("uses the rendered CSRF proof and reconciles to the server state", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        jobId: "job-1",
        saved: true,
        message: "Job saved.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CsrfProofProvider value="csrf-proof">
        <SaveJobAction jobId="job-1" initialSaved={false} />
      </CsrfProofProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /save job/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /remove saved job/i }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/saved-jobs/job-1");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("x-csrf-token")).toBe("csrf-proof");
    expect(screen.getByRole("status")).toHaveTextContent(/saved/i);
  });

  it("keeps the authoritative prior state and exposes a retryable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: "Try again." }),
      }),
    );
    render(
      <CsrfProofProvider value="csrf-proof">
        <SaveJobAction jobId="job-1" initialSaved />
      </CsrfProofProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /remove saved job/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/try again/i),
    );
    expect(
      screen.getByRole("button", { name: /remove saved job/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("refreshes a rotated proof and retries the same idempotent action", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrfProof: "rotated-proof" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jobId: "job-1",
          saved: false,
          message: "Job removed from saved jobs.",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CsrfProofProvider value="stale-proof">
        <SaveJobAction jobId="job-1" initialSaved />
      </CsrfProofProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /remove saved job/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save job/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/saved-jobs/job-1");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/identity/sessions");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/saved-jobs/job-1");
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(retryInit.method).toBe("DELETE");
    expect(new Headers(retryInit.headers).get("x-csrf-token")).toBe(
      "rotated-proof",
    );
  });
});
