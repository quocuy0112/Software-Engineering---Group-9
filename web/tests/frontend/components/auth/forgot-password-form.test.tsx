import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ForgotPasswordForm } from "@/frontend/features/authentication/components/forgot-password-form";

const { toast } = vi.hoisted(() => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  toast.dismiss.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
  window.localStorage.clear();
});

describe("forgot password form", () => {
  it("preserves the email, shows one success toast, and prevents duplicate submits", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    render(<ForgotPasswordForm />);
    const input = screen.getByLabelText("Email address");
    fireEvent.change(input, { target: { value: "user@example.test" } });
    const button = screen.getByRole("button", { name: /send reset/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolve(
      Response.json(
        { message: "Password-reset instructions will be sent to this email." },
        { status: 202 },
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password-reset instructions will be sent to this email.",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Password-reset instructions will be sent to this email.",
      { id: "forgot-password-status" },
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(input).toHaveValue("user@example.test");
  });

  it("shows an error toast when the email does not match an active account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { message: "No active account was found for this email." },
            { status: 404 },
          ),
        ),
      ),
    );

    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "user@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No active account was found for this email.",
        { id: "forgot-password-status" },
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
