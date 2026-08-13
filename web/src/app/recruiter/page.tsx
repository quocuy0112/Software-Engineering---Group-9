import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterRouteView } from "@/frontend/features/recruiter-workspace/recruiter-route-view";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter");
  const data = await readRecruiterJobManagementData(context.userId);
  // Keep the job-posting workspace reachable while the approved company
  // finishes its profile. The UI owns the posting gate and links to settings;
  // redirecting the whole workspace made the Job postings navigation appear
  // broken for approved recruiters.
  if (!data.companyId) {
    redirect("/recruiter/company-settings?required=profile");
  }
  return <RecruiterRouteView view="list" initialData={data} />;
}
