import "@/frontend/styles/workspace.css";
import "@/frontend/styles/responsive.css";
import "@/frontend/styles/recruiter-workspace-full.css";
import "@/frontend/styles/recruitment-pipeline.css";
import "@/frontend/features/recruitment-analytics/recruiter-analytics.css";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { recruiterRoutes } from "@/shared/routing/recruiter-routes";

export const dynamic = "force-dynamic";

export default async function RecruiterLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getWorkspaceContext();
  if (!context)
    redirect(
      `/login?returnTo=${encodeURIComponent(recruiterRoutes.jobPostings)}`,
    );

  return (
    <WorkspaceShell
      csrfProof={context.csrfProof}
      profile={context.account}
      initialLocale={context.initialLocale}
      initialRecruiterStatus={context.initialRecruiterStatus}
      initialWorkspaceMode="recruiter"
      recruiterContent={children}
    >
      <div />
    </WorkspaceShell>
  );
}
