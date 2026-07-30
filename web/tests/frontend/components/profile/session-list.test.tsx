import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionList } from "@/frontend/features/profile/components/session-list";

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  vi.restoreAllMocks();
  toast.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
});

describe("session list loading feedback", () => {
  it("replaces the loading toast with a success toast after sessions load", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<SessionList />);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Loading sessions.", {
        id: "session-list-status",
      }),
    );

    resolveRequest(
      Response.json({
        sessions: [],
        csrfProof: "csrf-proof",
      }),
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Sessions loaded successfully.",
        { id: "session-list-status" },
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(
      screen.getByText("No active sessions are available to display."),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/identity/sessions", {
      cache: "no-store",
    });
  });

  it("replaces the loading toast with an error toast when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );

    render(<SessionList />);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Unable to load sessions.", {
        id: "session-list-status",
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
