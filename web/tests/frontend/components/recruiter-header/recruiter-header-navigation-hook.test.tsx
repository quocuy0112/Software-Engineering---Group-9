import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useRecruiterHeaderNavigation,
  type NavigationAdapter,
} from "@/frontend/features/recruiter-header/client/use-recruiter-header-navigation";

describe("recruiter header navigation hook", () => {
  it("opens employer verification in the current Candidate workspace", () => {
    const adapter: NavigationAdapter = {
      openSameOrigin: vi.fn(),
      openExternal: vi.fn(),
    };
    const { result } = renderHook(() => useRecruiterHeaderNavigation(adapter));

    act(() => {
      result.current.open("/dashboard/employer-verification");
    });

    expect(adapter.openSameOrigin).toHaveBeenCalledWith(
      "/dashboard/employer-verification",
    );
    expect(adapter.openExternal).not.toHaveBeenCalled();
  });

  it("opens an approved external destination once and recovers on focus", () => {
    const adapter: NavigationAdapter = {
      openSameOrigin: vi.fn(),
      openExternal: vi.fn().mockReturnValue({} as Window),
    };
    const { result } = renderHook(() => useRecruiterHeaderNavigation(adapter));
    act(() => {
      result.current.open("https://recruiter.example.test");
      result.current.open("https://recruiter.example.test");
    });
    expect(adapter.openExternal).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      result.current.open("https://recruiter.example.test");
    });
    expect(adapter.openExternal).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after a synchronous adapter failure", () => {
    const adapter: NavigationAdapter = {
      openSameOrigin: vi.fn(),
      openExternal: vi.fn(() => {
        throw new Error("cancelled");
      }),
    };
    const { result } = renderHook(() => useRecruiterHeaderNavigation(adapter));
    act(() => {
      result.current.open("https://recruiter.example.test");
      result.current.open("https://recruiter.example.test");
    });
    expect(adapter.openExternal).toHaveBeenCalledTimes(2);
  });
});
