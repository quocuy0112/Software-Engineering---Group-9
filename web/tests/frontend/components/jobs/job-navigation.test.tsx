import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

    expect(
      within(screen.getByRole("banner")).getByRole("search", {
        name: "Global job search",
      }),
    ).toBeVisible();

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

  it("lets the results list grow with the page instead of creating a nested scroll region", async () => {
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
    expect(source).not.toContain("tabIndex={0}");
    expect(styles).toContain(".job-list");
    expect(styles).not.toContain(
      '.job-board-public-main .jobs-page,\n  .workspace-content[data-content-mode="job-board"] > .jobs-page',
    );
    expect(styles).not.toContain(
      ".job-filter-column,\n  .job-results {\n    position: static;",
    );
  });

  it("uses compact numeric pagination for job results", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/app/jobs/page.tsx"),
      "utf8",
    );
    const styles = await readFile(
      resolve(process.cwd(), "src/frontend/features/jobs/styles/job-board.css"),
      "utf8",
    );

    expect(source).toContain("function pageNumbers");
    expect(source).toContain("currentPage - 1");
    expect(source).toContain("currentPage + 1");
    expect(source).toContain("result.totalPages > 1");
    expect(source).toContain("pageHref(paginationParams, result.totalPages)");
    expect(source).toContain('className="job-pagination-progress"');
    expect(styles).toContain(".job-pagination-pages {");
    expect(styles).toContain("overflow-x: auto;");
  });

  it("keeps the Filters sidebar in the page scroll context", async () => {
    const styles = await readFile(
      resolve(process.cwd(), "src/frontend/features/jobs/styles/job-board.css"),
      "utf8",
    );
    const formSource = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/jobs/components/job-search-form.tsx",
      ),
      "utf8",
    );

    expect(styles).toContain("height: auto;");
    expect(styles).toContain("max-height: none;");
    expect(styles).not.toContain(".job-filter-column::-webkit-scrollbar {");
    expect(formSource).toContain('filterColumn.addEventListener("wheel"');
    expect(styles).toContain(".job-filter-mobile-trigger");
    expect(styles).toContain(".job-filter-drawer");
    expect(styles).toContain("max-height: min(88dvh, 52rem);");
    expect(styles).toContain(".job-filter-actions {");
    expect(styles).toContain("position: sticky;");
  });

  it("uses the Next.js apply query to open the detail-page modal", async () => {
    const detailSource = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/jobs/components/job-detail-redesign.tsx",
      ),
      "utf8",
    );
    const cardSource = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/jobs/components/job-card.tsx",
      ),
      "utf8",
    );
    const formSource = await readFile(
      resolve(
        process.cwd(),
        "src/frontend/features/jobs/components/apply-form-section.tsx",
      ),
      "utf8",
    );
    const styles = await readFile(
      resolve(process.cwd(), "src/frontend/features/jobs/styles/job-board.css"),
      "utf8",
    );

    expect(cardSource).toContain('"?apply=true"');
    expect(detailSource).toContain('params.get("apply") === "true"');
    expect(detailSource).not.toContain("scrollIntoView");
    expect(formSource).toContain('className="job-apply-modal-backdrop"');
    expect(formSource).toContain('role="dialog"');
    expect(styles).toContain(".job-apply-modal-body {");
    expect(styles).toContain("position: sticky;");
    expect(styles).toContain("bottom: 0;");
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
