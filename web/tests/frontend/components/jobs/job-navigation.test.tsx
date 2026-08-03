import { render, screen } from "@testing-library/react";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { JobBoardHeader } from "@/frontend/features/jobs/components/job-board-header";

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
