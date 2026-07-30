import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountRecoveryRequestForm } from "@/frontend/features/authentication/components/account-recovery-request-form";

const { toast } = vi.hoisted(() => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  toast.dismiss.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
});

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

  it("shows one success toast when recovery instructions are queued", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            message:
              "Account-recovery instructions will be sent to this email.",
          },
          { status: 202 },
        ),
      ),
    );
    render(<AccountRecoveryRequestForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "eligible@example.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send recovery instructions" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Account-recovery instructions will be sent to this email.",
        { id: "account-recovery-status" },
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows one error toast when no eligible account matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: "No eligible account was found for this email." },
            { status: 404 },
          ),
        ),
    );
    render(<AccountRecoveryRequestForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "missing@example.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send recovery instructions" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No eligible account was found for this email.",
        { id: "account-recovery-status" },
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
