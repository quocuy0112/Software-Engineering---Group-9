import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResetPasswordForm } from "@/frontend/features/authentication/components/auth/reset-password-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/reset-password");
});

describe("reset password form", () => {
  it("consumes a fragment token without echoing it and clears password state", async () => {
    window.history.replaceState(null, "", "/reset-password#token=opaque-test-token");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: "Your password has been reset. Sign in again." }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm />);
    const password = screen.getByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    fireEvent.change(password, { target: { value: "correct horse 2026" } });
    fireEvent.change(confirmation, { target: { value: "correct horse 2026" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /reset password/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Your password has been reset"));
    expect(fetchMock.mock.calls[0][1].body).toContain("opaque-test-token");
    expect(document.body.textContent).not.toContain("opaque-test-token");
    expect(password).toHaveValue("");
    expect(confirmation).toHaveValue("");
    expect(window.location.hash).toBe("");
  });
});
