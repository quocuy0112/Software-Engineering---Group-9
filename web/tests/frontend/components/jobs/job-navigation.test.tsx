import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { JobBoardHeader } from "@/frontend/features/jobs/components/job-board-header";
import { ThemeProvider } from "@/frontend/providers/theme-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/jobs",
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("job board navigation", () => {
  it("gives visitors direct browse and authentication paths", () => {
    render(<JobBoardHeader authenticated={false} />);

    expect(screen.getByRole("link", { name: /browse jobs/i })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fjobs",
    );
    expect(
      screen.getByRole("link", { name: /create account/i }),
    ).toHaveAttribute("href", "/register");
    expect(
      screen.getByRole("button", { name: /switch to dark mode/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles and persists the public Jobs theme preference", async () => {
    localStorage.clear();
    render(
      <ThemeProvider>
        <JobBoardHeader authenticated={false} />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", {
      name: /switch to dark mode/i,
    });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
    expect(localStorage.getItem("smarthire-theme")).toBe("dark");
  });

  it("links authenticated candidates back to their workspace", () => {
    render(<JobBoardHeader authenticated />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
      "href",
      "/profile",
    );
  });

  it("keeps authenticated Job pages inside the same workspace shell as Profile", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/app/jobs/layout.tsx"),
      "utf8",
    );

    expect(source).toContain("getWorkspaceContext");
    expect(source).toContain("<WorkspaceShell");
    expect(source).toContain("profile={context.account}");
  });

  it("keeps the Jobs heading fixed and gives each desktop pane its own focusable scroll region", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/app/jobs/page.tsx"),
      "utf8",
    );
    const styles = await readFile(
      resolve(process.cwd(), "src/frontend/features/jobs/styles/job-board.css"),
      "utf8",
    );

    expect(source).toContain('className="jobs-fixed-region"');
    expect(source).toContain('className="job-filter-column"');
    expect(source).toContain('className="job-results"');
    expect(source).toContain("tabIndex={0}");
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr)");
    expect(styles).toContain("overflow-y: auto");
    expect(styles).toContain("overscroll-behavior: contain");
    expect(styles).toContain("@media (min-width: 981px)");
    expect(styles).toContain(
      '.workspace-layout[data-sidebar-collapsed="true"]',
    );
    expect(styles).toContain("width: min(100%, 100rem)");
  });

  it("shows the Profile workspace bar and marks Jobs as active", () => {
    render(
      <WorkspaceShell
        csrfProof="proof"
        profile={{ name: "Job Candidate", email: "candidate@example.test" }}
      >
        <h1>Jobs</h1>
      </WorkspaceShell>,
    );

    expect(
      screen.getByRole("complementary", { name: "Workspace sidebar" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /open profile for job candidate/i }),
    ).toBeVisible();
  });
});
