import "@/frontend/styles/workspace.css";
import "@/frontend/styles/responsive.css";
import "@/frontend/features/jobs/styles/job-board.css";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { JobBoardHeader } from "@/frontend/features/jobs/components/job-board-header";

export default async function JobsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getWorkspaceContext();

  if (context) {
    return (
      <WorkspaceShell csrfProof={context.csrfProof} profile={context.account}>
        {children}
      </WorkspaceShell>
    );
  }

  return (
    <div className="job-board-layout">
      <JobBoardHeader authenticated={false} />
      <main className="job-board-public-main">{children}</main>
    </div>
  );
}
