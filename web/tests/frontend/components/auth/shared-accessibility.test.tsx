import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthStatus } from "@/frontend/features/authentication/components/auth-status";
import { FormFeedback } from "@/frontend/features/authentication/components/form-feedback";

describe("shared accessibility and feedback", () => {
  it("keeps errors in an assertive inline alert", () => {
    render(
      <AuthStatus status="Verification could not be completed." tone="error" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not be completed",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("preserves labelled error summaries and keyboard focus", () => {
    render(
      <FormFeedback errors={["Email is required"]} status="Please review" />,
    );
    const summary = screen
      .getByText("Please review the form")
      .closest<HTMLElement>("[role='alert']");
    expect(summary).not.toBeNull();
    if (!summary) throw new Error("Expected the error summary.");
    summary.focus();
    expect(summary).toHaveFocus();
    expect(screen.getAllByRole("alert")[1]).toHaveTextContent("Please review");
    fireEvent.keyDown(summary, { key: "Escape" });
    expect(summary).toBeInTheDocument();
  });

  it("documents responsive and reduced-motion safeguards in the auth stylesheet", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const css = await readFile(
      resolve(process.cwd(), "src/frontend/styles/auth.css"),
      "utf8",
    );
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/max-width:\s*320px/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });
});
