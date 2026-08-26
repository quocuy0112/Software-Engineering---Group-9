import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterAnalyticsOverview } from "@/frontend/features/recruitment-analytics/recruiter-analytics-overview";

export const dynamic = "force-dynamic";

export default async function RecruiterAnalyticsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fanalytics");

  const data = await readRecruiterJobManagementData(context.userId);
  if (!data.companyId) redirect("/recruiter/company-settings?required=profile");

  return (
    <RecruiterAnalyticsOverview jobs={data.jobs} companies={data.companies} />
  );
}
