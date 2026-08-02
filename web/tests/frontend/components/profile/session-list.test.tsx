import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionList } from "@/frontend/features/profile/components/session-list";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session list loading feedback", () => {
  it("shows loading inline and clears routine feedback after sessions load", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    render(<SessionList />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading sessions.");

    resolveRequest(
      Response.json({
        sessions: [],
        csrfProof: "csrf-proof",
      }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText("No active sessions are available to display."),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith("/api/identity/sessions", {
      cache: "no-store",
    });
  });

  it("uses an assertive inline alert when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ message: "Unavailable" }, { status: 503 }),
    );

    render(<SessionList />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load sessions.",
    );
  });

  it("asks for confirmation before revoking another device", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input).endsWith("/device-1")) {
          return Promise.resolve(Response.json({ ok: true }));
        }
        return Promise.resolve(
          Response.json({
            sessions: [
              {
                reference: "device-1",
                device: "Chrome on Windows",
                approximateLocation: "Ho Chi Minh City",
                lastActiveAt: "2026-08-01T00:00:00.000Z",
                current: false,
              },
            ],
            csrfProof: "csrf-proof",
          }),
        );
      });

    render(<SessionList />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Revoke session" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Revoke this session?" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Revoke session" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/identity/sessions/device-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
