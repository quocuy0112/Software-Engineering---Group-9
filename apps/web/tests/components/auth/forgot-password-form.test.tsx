import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("forgot password form", () => {
  it("preserves the email, shows generic status, and prevents duplicate submits", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    render(<ForgotPasswordForm />);
    const input = screen.getByLabelText("Email address");
    fireEvent.change(input, { target: { value: "user@example.test" } });
    const button = screen.getByRole("button", { name: /send reset/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    resolve(Response.json({ message: "If the account is eligible, password-reset instructions will be sent." }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("If the account is eligible"));
    expect(input).toHaveValue("user@example.test");
  });

  it("shows how many reset attempts remain before the limit is reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { message: "If the account is eligible, password-reset instructions will be sent." },
            { status: 202 },
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
      expect(screen.getByRole("status")).toHaveTextContent("2 attempts remaining"),
    );
  });
});
