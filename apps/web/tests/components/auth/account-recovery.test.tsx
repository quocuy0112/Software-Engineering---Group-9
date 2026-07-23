import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountRecoveryRequestForm } from "@/components/auth/account-recovery-request-form";

describe("account recovery request surface", () => {
  it("explains the lower-assurance workflow and has an accessible email field", () => {
    render(<AccountRecoveryRequestForm />);
    expect(
      screen.getByRole("heading", { name: /lost access to every factor/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(
      screen.getByText(/lower assurance than using your password/i),
    ).toBeInTheDocument();
  });
});
