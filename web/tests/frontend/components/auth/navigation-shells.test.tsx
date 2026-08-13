import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AuthShell } from "@/frontend/features/authentication/components/auth-shell";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { DashboardView } from "@/frontend/features/dashboard/components/dashboard-view";
import { ProfileNavigation } from "@/frontend/features/profile/components/profile-navigation";
import { ProfileAccountView } from "@/frontend/features/profile/components/profile-account-view";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/profile/security",
  useRouter: () => navigation,
}));

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};

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
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("link", { name: "Forgot password" }),
    ).toHaveAttribute("href", "/forgot-password");
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

  it("keeps the workspace shell in English", () => {
    render(
      <WorkspaceShell
        csrfProof="proof"
        profile={{
          name: "Thao Nguyen",
          email: "thao@example.test",
        }}
      >
        <ProfileNavigation active="overview" />
      </WorkspaceShell>,
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Professional" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("hydrates and renders the saved Vietnamese workspace locale", async () => {
    render(
      <WorkspaceShell
        csrfProof="proof"
        initialLocale="vi"
        profile={{
          name: "Thao Nguyen",
          email: "thao@example.test",
        }}
      >
        <h1>Hồ sơ</h1>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("lang", "vi");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("lang", "vi"),
    );
    expect(
      screen.getByRole("navigation", { name: /không gian ứng viên/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /bảng điều khiển/i }),
    ).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("button", { name: /đăng xuất/i })).toBeVisible();
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
    expect(
      screen.getByRole("button", { name: "Open workspace menu" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Open workspace menu" }),
    ).toHaveFocus();
  });

  it("closes the mobile menu when the user taps outside it", () => {
    render(
      <WorkspaceShell
        csrfProof="proof"
        profile={{ name: "Thao Nguyen", email: "thao@example.test" }}
      >
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open workspace menu" }),
    );
    fireEvent.pointerDown(document.body);
    expect(
      screen.getByRole("button", { name: "Open workspace menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("updates the workspace account chip immediately after the full name is saved", async () => {
    navigation.refresh.mockClear();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        identity: {
          name: "Binh Nguyen",
          email: "thao@example.test",
          emailVerified: true,
          accountState: "ACTIVE",
          createdAt: "2026-07-31T00:00:00.000Z",
          pendingEmailChange: null,
        },
        warnings: [],
        message: "Account identity saved.",
      }),
    );

    render(
      <WorkspaceShell
        csrfProof="proof"
        profile={{ name: "Thao Nguyen", email: "thao@example.test" }}
      >
        <ProfileAccountView
          csrfProof="proof"
          initialIdentity={{
            name: "Thao Nguyen",
            email: "thao@example.test",
            emailVerified: true,
            accountState: "ACTIVE",
            createdAt: "2026-07-31T00:00:00.000Z",
            pendingEmailChange: null,
          }}
        />
      </WorkspaceShell>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Binh Nguyen" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save full name" }));

    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Open profile for Binh Nguyen" }),
      ).toBeVisible(),
    );
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("collapses the desktop sidebar while keeping navigation and sign-out accessible", () => {
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Dashboard</h1>
      </WorkspaceShell>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });
    const toggle = screen.getByRole("button", {
      name: "Collapse workspace sidebar",
    });
    const navigation = screen.getByRole("navigation", {
      name: /candidate workspace/i,
    });
    const signOut = screen.getByRole("button", { name: "Sign out" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      navigation.querySelector(".workspace-navigation-scroll"),
    ).not.toBeNull();
    expect(signOut.parentElement).toHaveClass("workspace-navigation-footer");

    fireEvent.click(toggle);

    expect(sidebar).toHaveAttribute("data-collapsed", "true");
    expect(sidebar.parentElement).toHaveAttribute(
      "data-sidebar-collapsed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Expand workspace sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  it("lets an expanded desktop sidebar grow before collapsing it to icons", () => {
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Dashboard</h1>
      </WorkspaceShell>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar",
    });

    expect(resizeHandle).toHaveAttribute("aria-valuemin", "220");
    expect(
      sidebar.querySelector(".workspace-sidebar-width-sizer"),
    ).toHaveTextContent("Job Recommendation Settings");
    fireEvent.keyDown(resizeHandle, { key: "ArrowRight" });
    expect(sidebar.parentElement).toHaveStyle(
      "--sh-sidebar-expanded-width: 236px",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse workspace sidebar" }),
    );
    expect(sidebar.parentElement).toHaveStyle(
      "--sh-sidebar-expanded-width: 236px",
    );
  });

  it("persists explicit workspace switches and keeps the recruiter switcher in the header", () => {
    document.cookie = "";
    render(
      <WorkspaceShell
        csrfProof="proof"
        initialRecruiterStatus={{
          state: "APPROVED",
          destinationKind: "RECRUITER_WORKSPACE",
          href: "https://recruiter.example.test",
          observedAt: "2026-08-11T00:00:00.000Z",
        }}
        initialRecruiterJobData={{ jobs: [], companies: [], companyId: null }}
        contentMode="job-board"
        profile={{ name: "Recruiter User", email: "recruiter@example.test" }}
      >
        <h1>Dashboard</h1>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Post a Job" }));

    expect(navigation.push).toHaveBeenCalledWith("/recruiter");
    expect(document.cookie).toContain("smarthire-workspace-mode=recruiter");
  });

  it("keeps the sidebar frame width synchronized with the collapsed grid track", async () => {
    const css = await readFile(
      resolve(process.cwd(), "src/frontend/styles/workspace.css"),
      "utf8",
    );
    expect(css).toContain(
      "--sh-sidebar-current-width: var(--sh-sidebar-width);",
    );
    expect(css).toContain("--sh-sidebar-current-width: 4.75rem;");
    expect(css).toContain("width: var(--sh-sidebar-current-width);");
  });

  it("shows actionable dashboard data without future placeholders", () => {
    render(
      <DashboardView
        account={{
          name: "Thao Nguyen",
          hasAvatar: false,
          twoFactorEnabled: false,
        }}
        profile={emptyProfile}
      />,
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Account security/ }),
    ).toHaveAttribute("href", "/profile/security");
    expect(
      screen.getByRole("link", { name: /Job opportunities/ }),
    ).toHaveAttribute("href", "/jobs");
    expect(
      screen.getByRole("progressbar", { name: "Profile completion" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.queryByText(/coming later/i)).toBeNull();
    expect(screen.queryByText(/applications|analytics/i)).toBeNull();
  });

  it("scores profile quality and links every remaining step to its editor", () => {
    render(
      <DashboardView
        account={{
          name: "Thao Nguyen",
          hasAvatar: true,
          twoFactorEnabled: true,
        }}
        profile={{
          revision: 1,
          empty: false,
          basics: {
            headline: "Senior software product engineer",
            summary:
              "I design and deliver reliable software products with cross-functional teams, measurable outcomes, thoughtful accessibility, and maintainable engineering practices.",
            phone: null,
            location: null,
          },
          skills: [
            { id: "skill-1", label: "TypeScript" },
            { id: "skill-2", label: "Product design" },
            { id: "skill-3", label: "Accessibility" },
          ],
          experience: [
            {
              id: "experience-1",
              title: "Senior Engineer",
              company: "SmartHire",
              description:
                "Led the delivery of accessible product experiences and improved reliability across the core candidate workflow.",
              startDate: "2024-01-01",
              endDate: null,
              current: true,
            },
          ],
          education: [
            {
              id: "education-1",
              institution: "HCMUS",
              degree: "Bachelor",
              field: "Software Engineering",
              startDate: "2023-01-01",
              endDate: null,
              current: true,
            },
          ],
          socialLinks: [
            { id: "social-1", url: "https://github.com/smarthire" },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("progressbar", { name: "Profile completion" }),
    ).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Profile ready")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Add a professional link/i }),
    ).toHaveAttribute("href", "/profile#profile-social-section");
  });

  it("exposes directly addressable profile tabs with active state", () => {
    render(<ProfileNavigation active="security" />);

    expect(screen.getByRole("navigation", { name: "Profile" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Professional" })).toHaveAttribute(
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
  it("uses the rendered CSRF proof and client navigation on normal sign-out", async () => {
    navigation.replace.mockClear();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ message: "Signed out." }));

    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Security</h1>
      </WorkspaceShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/login"),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/identity/logout");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-csrf-token")).toBe("proof");
    fetchMock.mockRestore();
  });

  it("refreshes a rotated CSRF proof, prevents duplicate sign-out, and announces failure", async () => {
    let release!: () => void;
    let logoutRequests = 0;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((input) => {
        if (String(input).endsWith("/api/identity/sessions")) {
          return Promise.resolve(
            Response.json({ sessions: [], csrfProof: "rotated-proof" }),
          );
        }
        logoutRequests += 1;
        if (logoutRequests > 1) {
          return Promise.resolve(
            Response.json({ message: "Request rejected." }, { status: 403 }),
          );
        }
        return new Promise<Response>((resolve) => {
          release = () =>
            resolve(
              Response.json({ message: "Request rejected." }, { status: 403 }),
            );
        });
      });
    render(
      <WorkspaceShell csrfProof="proof">
        <h1>Security</h1>
      </WorkspaceShell>,
    );

    const signOut = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(signOut);
    fireEvent.click(signOut);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/identity/logout");
    expect(firstInit.method).toBe("POST");
    expect(new Headers(firstInit.headers).get("x-csrf-token")).toBe("proof");
    expect(screen.getByRole("button", { name: /Signing out/ })).toBeDisabled();
    release();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/identity/sessions", {
      cache: "no-store",
    });
    const retryInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/identity/logout");
    expect(retryInit.method).toBe("POST");
    expect(new Headers(retryInit.headers).get("x-csrf-token")).toBe(
      "rotated-proof",
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to sign out. Please try again.",
      ),
    );
    fetchMock.mockRestore();
  });
});
