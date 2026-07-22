import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthShell } from "@/components/auth/auth-shell";
import { WorkspaceShell } from "@/components/auth/workspace-shell";
import DashboardPage from "@/app/(workspace)/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/security",
}));

describe("identity navigation shells", () => {
  it("exposes branded public auth links and an accessible destination landmark", () => {
    render(
      <AuthShell>
        <h1>Sign in to SmartHire</h1>
      </AuthShell>,
    );

    expect(screen.getByRole("link", { name: /SmartHire/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("navigation", { name: "Authentication" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Forgot password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("keeps the public navigation keyboard reachable", () => {
    render(
      <AuthShell>
        <h1>Check your email</h1>
      </AuthShell>,
    );
    const signIn = screen.getByRole("link", { name: "Sign in" });
    signIn.focus();
    expect(signIn).toHaveFocus();
  });

  it("marks the active workspace destination and controls the mobile menu", () => {
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const menu = screen.getByRole("button", { name: "Open workspace menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(
      screen.getByRole("button", { name: "Close workspace menu" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the dashboard limited to identity shortcuts and future placeholders", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Security/ })).toHaveAttribute(
      "href",
      "/settings/security",
    );
    expect(screen.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "href",
      "/settings/sessions",
    );
    expect(screen.getByText(/coming later/i)).toBeVisible();
    expect(screen.queryByText(/jobs|applications|analytics/i)).toBeNull();
  });

  it("prevents duplicate sign-out and announces a generic failure", async () => {
    let release!: () => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              Response.json(
                { message: "Request rejected." },
                { status: 403 },
              ),
            );
        }),
    );
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    const signOut = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(signOut);
    fireEvent.click(signOut);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: /Signing out/ }),
    ).toBeDisabled();
    release();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Unable to sign out. Please try again.",
      ),
    );
    fetchMock.mockRestore();
  });
});
