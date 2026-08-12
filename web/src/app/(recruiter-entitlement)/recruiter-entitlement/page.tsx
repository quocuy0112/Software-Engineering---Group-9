import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { WorkspaceShell } from "@/frontend/features/dashboard/components/workspace-shell";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Recruiter workspace",
  robots: { index: false, follow: false },
};

export default async function RecruiterEntitlementPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2F");
  const initialRecruiterJobData = await readRecruiterJobManagementData(
    context.userId,
  );

  return (
    <WorkspaceShell
      csrfProof={context.csrfProof}
      profile={context.account}
      initialLocale={context.initialLocale}
      initialWorkspaceMode="recruiter"
      initialRecruiterJobData={initialRecruiterJobData}
    >
      <div />
    </WorkspaceShell>
  );
}
