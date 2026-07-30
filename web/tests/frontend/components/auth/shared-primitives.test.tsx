import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasswordField } from "@/frontend/features/authentication/components/password-field";
import { FormFeedback } from "@/frontend/features/authentication/components/form-feedback";
import { useSafeSubmit } from "@/frontend/features/authentication/components/use-safe-submit";
import { focusErrorSummary } from "@/frontend/accessibility/focus";
import { SecurityShell } from "@/frontend/features/authentication/components/security-shell";
function SubmitFixture({ operation }: { operation: () => Promise<void> }) {
  const { submit, busy } = useSafeSubmit(operation);
  const [done, setDone] = useState(false);
  return (
    <button
      disabled={busy}
      aria-busy={busy}
      onClick={() => void submit().then(setDone)}
    >
      {done ? "Done" : "Submit"}
    </button>
  );
}
describe("shared auth primitives", () => {
  it("labels password input, permits paste, and exposes keyboard-operable visibility", () => {
    render(
      <PasswordField
        label="Current password"
        autoComplete="current-password"
      />,
    );
    const input = screen.getByLabelText("Current password") as HTMLInputElement;
    expect(input.autocomplete).toBe("current-password");
    fireEvent.change(input, { target: { value: "pasted value" } });
    expect(input.value).toBe("pasted value");
    fireEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(input.type).toBe("text");
    const hide = screen.getByRole("button", {
      name: "Hide password",
    });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    expect(hide.querySelector("svg")).toBeTruthy();
    expect(screen.queryByText("Hide")).toBeNull();
    fireEvent.click(hide);
    expect(input.type).toBe("password");
    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
  it("announces and focuses the error summary", () => {
    render(<FormFeedback errors={["Email is required"]} status="Waiting" />);
    expect(screen.getByRole("status")).toHaveTextContent("Waiting");
    expect(focusErrorSummary()).toBe(true);
    expect(screen.getByRole("alert")).toHaveFocus();
  });
  it("suppresses duplicate submissions and exposes busy state", async () => {
    let release!: () => void;
    const operation = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<SubmitFixture operation={operation} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute("aria-busy", "true");
    release();
  });
  it("keeps settings controls inside the semantic security shell", () => {
    render(
      <SecurityShell>
        <h1>Security</h1>
        <button>Revoke session</button>
      </SecurityShell>,
    );
    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("button", { name: "Revoke session" }),
    );
  });
});
