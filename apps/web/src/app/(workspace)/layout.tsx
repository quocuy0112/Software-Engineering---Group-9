import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/frontend/features/authentication/components/auth/workspace-shell";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fdashboard");

  return (
    <WorkspaceShell
      csrfProof={context.csrfProof}
      profile={context.account}
    >
      {children}
    </WorkspaceShell>
  );
}
