import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ResetPasswordForm } from "@/frontend/features/authentication/components/reset-password-form";

const { navigation, toast } = vi.hoisted(() => ({
  navigation: { replace: vi.fn() },
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigation.replace.mockClear();
  toast.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
  window.history.replaceState(null, "", "/reset-password");
});

describe("reset password form", () => {
  it("shows a success toast and redirects to sign in after resetting the password", async () => {
    window.history.replaceState(
      null,
      "",
      "/reset-password#token=opaque-test-token",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        message: "Your password has been reset. Sign in again.",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm />);
    const password = screen.getByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    fireEvent.change(password, { target: { value: "correct horse 2026" } });
    fireEvent.change(confirmation, { target: { value: "correct horse 2026" } });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /reset password/i }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Your password has been reset",
      ),
    );
    expect(fetchMock.mock.calls[0][1].body).toContain("opaque-test-token");
    expect(document.body.textContent).not.toContain("opaque-test-token");
    expect(password).toHaveValue("");
    expect(confirmation).toHaveValue("");
    expect(window.location.hash).toBe("");
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Your password has been reset. Sign in again.",
        { id: "reset-password-status" },
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
    await waitFor(
      () => expect(navigation.replace).toHaveBeenCalledWith("/login"),
      { timeout: 1_500 },
    );
  });

  it("shows an error toast without calling the API when passwords do not match", async () => {
    window.history.replaceState(
      null,
      "",
      "/reset-password#token=opaque-test-token",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ResetPasswordForm />);
    const password = screen.getByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    fireEvent.change(password, { target: { value: "correct horse 2026" } });
    fireEvent.change(confirmation, {
      target: { value: "different horse 2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Passwords do not match.", {
        id: "reset-password-status",
      }),
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-tone", "error");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(password).toHaveValue("correct horse 2026");
    expect(confirmation).toHaveValue("different horse 2026");
  });

  it("keeps the reset token when mounted in React Strict Mode", async () => {
    window.history.replaceState(
      null,
      "",
      "/reset-password#token=opaque-test-token",
    );
    render(
      <StrictMode>
        <ResetPasswordForm />
      </StrictMode>,
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct horse 2026" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct horse 2026" },
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /reset password/i }),
      ).toBeEnabled(),
    );
  });
});
