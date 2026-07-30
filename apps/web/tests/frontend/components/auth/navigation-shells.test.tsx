import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthShell } from "@/frontend/features/authentication/components/auth/auth-shell";
import { WorkspaceShell } from "@/frontend/features/authentication/components/auth/workspace-shell";
import { ProfileNavigation } from "@/frontend/features/authentication/components/auth/profile-navigation";
import DashboardPage from "@/app/(workspace)/dashboard/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/security",
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
      <WorkspaceShell
        csrfProof="proof"
        profile={{ name: "Thao Nguyen", email: "thao@example.test" }}
      >
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Open profile for Thao Nguyen" }),
    ).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByText("Thao Nguyen")).toBeVisible();
    expect(screen.getByText("thao@example.test")).toBeVisible();
    const menu = screen.getByRole("button", { name: "Open workspace menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(
      screen.getByRole("button", { name: "Close workspace menu" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("closes the mobile menu with Escape and returns focus to its toggle", () => {
    render(
      <WorkspaceShell
        csrfProof="proof"
        profile={{ name: "Thao Nguyen", email: "thao@example.test" }}
      >
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    const menu = screen.getByRole("button", { name: "Open workspace menu" });
    fireEvent.click(menu);
    expect(
      screen.getByRole("button", { name: "Close workspace menu" }),
    ).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open workspace menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Open workspace menu" })).toHaveFocus();
  });

  it("keeps the dashboard limited to identity shortcuts and future placeholders", () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Security/ })).toHaveAttribute(
      "href",
      "/profile/security",
    );
    expect(screen.getByRole("link", { name: /Sessions/ })).toHaveAttribute(
      "href",
      "/profile/sessions",
    );
    expect(screen.getByText(/coming later/i)).toBeVisible();
    expect(screen.queryByText(/jobs|applications|analytics/i)).toBeNull();
  });

  it("exposes directly addressable profile tabs with active state", () => {
    render(<ProfileNavigation active="security" />);

    expect(screen.getByRole("navigation", { name: "Profile" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "href",
      "/profile/security",
    );
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Sessions" })).toHaveAttribute(
      "href",
      "/profile/sessions",
    );
  });
  it("refreshes a rotated CSRF proof, prevents duplicate sign-out, and announces failure", async () => {
    let release!: () => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      (input) => {
        if (String(input).endsWith("/api/identity/sessions")) {
          return Promise.resolve(
            Response.json({ sessions: [], csrfProof: "rotated-proof" }),
          );
        }
        return new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              Response.json(
                { message: "Request rejected." },
                { status: 403 },
              ),
            );
        });
      },
    );
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    const signOut = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(signOut);
    fireEvent.click(signOut);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/identity/logout",
      expect.objectContaining({
        method: "POST",
        headers: { "x-csrf-token": "rotated-proof" },
      }),
    );
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
