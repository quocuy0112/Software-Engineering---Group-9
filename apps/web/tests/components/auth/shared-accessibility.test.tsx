import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthStatus } from "@/components/auth/auth-status";
import { FormFeedback } from "@/components/auth/form-feedback";

const { toast } = vi.hoisted(() => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

describe("shared accessibility and feedback", () => {
  it("keeps inline live feedback while sending the same safe message to Sonner", async () => {
    render(<AuthStatus status="Verification could not be completed." tone="error" />);
    expect(screen.getByRole("status")).toHaveTextContent("could not be completed");
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Verification could not be completed."));
  });

  it("preserves labelled error summaries and keyboard focus", () => {
    render(<FormFeedback errors={["Email is required"]} status="Please review" />);
    const summary = screen.getByRole("alert");
    summary.focus();
    expect(summary).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Please review");
    fireEvent.keyDown(summary, { key: "Escape" });
    expect(summary).toBeInTheDocument();
  });

  it("documents responsive and reduced-motion safeguards in the auth stylesheet", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const css = await readFile(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/max-width:\s*320px/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });
});
