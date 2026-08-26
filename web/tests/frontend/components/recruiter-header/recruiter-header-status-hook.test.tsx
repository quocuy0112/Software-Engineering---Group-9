import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRecruiterHeaderStatus } from "@/frontend/features/recruiter-header/client/use-recruiter-header-status";
import { RECRUITER_AUTHORITY_CHANGED_EVENT } from "@/shared/contracts/recruiter-header-status";

const initialStatus = {
  state: "NEVER_APPLIED" as const,
  destinationKind: "EMPLOYER_VERIFICATION" as const,
  href: "/dashboard/employer-verification" as const,
  observedAt: "2026-08-11T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("recruiter header status hook", () => {
  it("adopts server initial state without a mount request", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() =>
      useRecruiterHeaderStatus(initialStatus),
    );
    expect(result.current.status).toEqual(initialStatus);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes on focus and rejects malformed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "INVALID" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { result } = renderHook(() =>
      useRecruiterHeaderStatus(initialStatus),
    );
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(result.current.status).toBeNull();
    expect(result.current.unavailable).toBe(true);
  });

  it("refreshes immediately when recruiter authority changes", async () => {
    const approvedStatus = {
      state: "APPROVED" as const,
      destinationKind: "RECRUITER_WORKSPACE" as const,
      href: "/recruiter/job-postings" as const,
      observedAt: "2026-08-11T00:00:00.000Z",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(initialStatus)),
    );
    const { result } = renderHook(() =>
      useRecruiterHeaderStatus(approvedStatus),
    );

    await act(async () => {
      window.dispatchEvent(new Event(RECRUITER_AUTHORITY_CHANGED_EVENT));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toEqual(initialStatus);
  });

  it("does not poll hidden tabs and polls visible tabs every thirty seconds", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(initialStatus)));
    renderHook(() => useRecruiterHeaderStatus(initialStatus));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fetch).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
