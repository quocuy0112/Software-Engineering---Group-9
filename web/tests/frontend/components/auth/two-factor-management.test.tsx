import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TwoFactorManagement } from "@/frontend/features/profile/components/two-factor-management";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("two-factor management UI", () => {
  it("requires proof, shows exactly ten codes once, and clears them", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetch = vi.fn((url: string) =>
      url.includes("sessions")
        ? Promise.resolve(Response.json({ csrfProof: "p" }))
        : Promise.resolve(
            Response.json({
              backupCodes: Array.from({ length: 10 }, (_, i) => `code-${i}`),
            }),
          ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<TwoFactorManagement />);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/identity/sessions",
        expect.anything(),
      ),
    );
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("Six-digit TOTP code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Regenerate/ }));
    expect(
      await screen.findByText("Save your ten new backup codes"),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: /I saved/ }));
    expect(screen.queryByRole("listitem")).toBeNull();
  });
  it("confirms disablement and prevents duplicate action while loading", async () => {
    let resolve!: (v: Response) => void;
    const fetch = vi.fn((url: string) =>
      url.includes("sessions")
        ? Promise.resolve(Response.json({ csrfProof: "p" }))
        : new Promise<Response>((r) => (resolve = r)),
    );
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TwoFactorManagement />);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/identity/sessions",
        expect.anything(),
      ),
    );
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "password" },
    });
    fireEvent.change(screen.getByLabelText("Six-digit TOTP code"), {
      target: { value: "123456" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Disable/ })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /Disable/ }));
    fireEvent.click(screen.getByRole("button", { name: /Disable/ }));
    expect(fetch).toHaveBeenCalledTimes(2);
    resolve(Response.json({ message: "ok" }));
  });
});
