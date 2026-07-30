import "../../frontend/styles/workspace.css";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fdashboard");

  return (
    <WorkspaceShell csrfProof={context.csrfProof} profile={context.account}>
      {children}
    </WorkspaceShell>
  );
}
