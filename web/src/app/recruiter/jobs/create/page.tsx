import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterRouteView } from "@/frontend/features/recruiter-workspace/recruiter-route-view";

export const dynamic = "force-dynamic";

export default async function RecruiterCreateJobPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fjobs%2Fcreate");
  const data = await readRecruiterJobManagementData(context.userId);
  if (!data.companyId || data.companyProfileComplete === false) {
    redirect("/recruiter/company-settings?required=profile");
  }
  return <RecruiterRouteView view="create" initialData={data} />;
}
