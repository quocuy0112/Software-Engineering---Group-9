import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTwoFactorPage } from "@/frontend/features/admin/auth/admin-two-factor-page";
import { StepUpDialog } from "@/frontend/features/admin/auth/step-up-dialog";
import { adminAuthProvider } from "@/frontend/features/admin/app/auth-provider";

describe("admin authentication UI", () => {
  afterEach(() => vi.restoreAllMocks());
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
  it("prevents duplicate factor submissions while verification is pending", async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finishRequest = resolve;
        }),
    );
    const onComplete = vi.fn();
    render(<AdminTwoFactorPage onComplete={onComplete} />);
    fireEvent.change(
      screen.getByRole("textbox", { name: /Six-digit authenticator code/u }),
      { target: { value: "123456" } },
    );
    const button = screen.getByRole("button", {
      name: "Verify and designate this session",
    });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Verifying…" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finishRequest?.(Response.json({ authenticated: true }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
  it("binds sensitive-action step-up to the authenticated CSRF proof", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ accountId: "admin-1", csrfToken: "csrf-proof" }),
      )
      .mockResolvedValueOnce(Response.json({ verified: true }));
    await adminAuthProvider.checkAuth?.({});
    const onVerified = vi.fn();
    render(<StepUpDialog open onCancel={vi.fn()} onVerified={onVerified} />);
    fireEvent.change(
      screen.getByRole("textbox", { name: /Six-digit authenticator code/u }),
      { target: { value: "123456" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[1]?.[1];
    expect(new Headers(init?.headers).get("x-csrf-token")).toBe("csrf-proof");
    expect(JSON.parse(String(init?.body))).toEqual({
      code: "123456",
      factor: "totp",
    });
  });
  it("uses a labelled modal for sensitive-action step-up", () => {
    render(<StepUpDialog open onCancel={vi.fn()} onVerified={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Verify sensitive action" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});
