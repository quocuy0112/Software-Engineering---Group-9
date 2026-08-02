import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordChangeForm } from "@/frontend/features/profile/components/password-change-form";

const values = {
  current: "Current form password 2026!",
  next: "Changed form password 2026!",
};

function fillForm() {
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: values.current },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: values.next },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: values.next },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("password-change accessibility", () => {
  it("labels all fields, permits paste, exposes autocomplete, and toggles each field's visibility", () => {
    render(<PasswordChangeForm csrfProof="csrf-proof" />);
    const current = screen.getByLabelText("Current password");
    const next = screen.getByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    expect(current).toHaveAttribute("autocomplete", "current-password");
    expect(next).toHaveAttribute("autocomplete", "new-password");
    expect(confirmation).toHaveAttribute("autocomplete", "new-password");
    expect(
      fireEvent.paste(next, {
        clipboardData: { getData: () => values.next },
      }),
    ).toBe(true);
    expect(current).toHaveAttribute("type", "password");
    expect(next).toHaveAttribute("type", "password");
    expect(confirmation).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Show passwords: Current password"));
    expect(current).toHaveAttribute("type", "text");
    expect(next).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Show passwords: New password"));
    expect(next).toHaveAttribute("type", "text");
    expect(confirmation).toHaveAttribute("type", "password");
    fireEvent.click(
      screen.getByLabelText("Show passwords: Confirm new password"),
    );
    expect(confirmation).toHaveAttribute("type", "text");
    expect(screen.getByText(/12 to 128 Unicode characters/i)).toBeVisible();
    expect(screen.getByText(/spaces are allowed/i)).toBeVisible();
  });

  it("retains all values and focuses a persistent error summary", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        {
          code: "VALIDATION_ERROR",
          message: "Review the highlighted fields.",
          fieldErrors: {
            newPassword: ["Choose a less common password."],
          },
        },
        { status: 400 },
      ),
    );
    render(<PasswordChangeForm csrfProof="csrf-proof" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Review the highlighted fields.");
    expect(alert).toHaveTextContent("Choose a less common password.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText("Current password")).toHaveValue(
      values.current,
    );
    expect(screen.getByLabelText("New password")).toHaveValue(values.next);
    expect(screen.getByLabelText("Confirm new password")).toHaveValue(
      values.next,
    );
  });

  it("announces account lock/retry metadata and prevents another submit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        {
          code: "PASSWORD_CHANGE_LOCKED",
          message: "Too many incorrect current-password attempts.",
          retryAfterSeconds: 900,
        },
        { status: 429 },
      ),
    );
    render(<PasswordChangeForm csrfProof="csrf-proof" />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/too many/i);
    expect(alert).toHaveTextContent(/900 seconds/i);
    expect(
      screen.getByRole("button", { name: /try again in/i }),
    ).toBeDisabled();
  });

  it("sends CSRF/idempotency once, announces success, and clears secrets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        status: "success",
        message: "Password changed. Other sessions were signed out.",
      }),
    );
    render(<PasswordChangeForm csrfProof="csrf-proof" />);
    fillForm();
    const submit = screen.getByRole("button", { name: "Change password" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(await screen.findByRole("status")).toHaveTextContent(
      /password changed/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("csrf-proof");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toMatch(
      /^[A-Za-z0-9_-]{20,128}$/,
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("ships focus, reduced-motion, non-color, and 320px-safe form styles", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/frontend/styles/profile.css"),
      "utf8",
    );
    expect(css).toMatch(/\.password-change-form/);
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).toMatch(/\[data-feedback-kind=["']error["']\]/);
    const baseCss = readFileSync(
      resolve(process.cwd(), "src/frontend/styles/base.css"),
      "utf8",
    );
    expect(baseCss).toMatch(/\.password-control/);
    expect(baseCss).toMatch(/\.password-visibility-button/);
  });
});
