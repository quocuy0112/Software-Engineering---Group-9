import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";

describe("AuthStatus", () => {
  it("keeps a multiline error in one assertive inline alert", () => {
    render(<AuthStatus status={"First issue\nSecond issue"} tone="error" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("First issue");
    expect(alert).toHaveTextContent("Second issue");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
