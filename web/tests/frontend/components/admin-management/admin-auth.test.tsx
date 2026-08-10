import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminTwoFactorPage } from "@/frontend/features/admin/auth/admin-two-factor-page";
import { StepUpDialog } from "@/frontend/features/admin/auth/step-up-dialog";
describe("admin authentication UI", () => {
  it("names the initial factor input and designation action", () => {
    render(<AdminTwoFactorPage onComplete={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Two-factor verification" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: /Six-digit authenticator code/u }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Verify and designate this session" }),
    ).toBeVisible();
  });
  it("uses a labelled modal for sensitive-action step-up", () => {
    render(<StepUpDialog open onCancel={vi.fn()} onVerified={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Confirm sensitive action" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});
