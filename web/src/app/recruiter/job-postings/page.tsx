import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterRouteView } from "@/frontend/features/recruiter-workspace/recruiter-route-view";
import { parseRecruiterJobPostingTab } from "@/shared/routing/recruiter-routes";

export const dynamic = "force-dynamic";

export default async function RecruiterJobPostingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Frecruiter%2Fjob-postings");

  const data = await readRecruiterJobManagementData(context.userId);
  // Keep the job-posting workspace reachable while the approved company
  // finishes its profile. The UI owns the posting gate and links to settings.
  if (!data.companyId) {
    redirect("/recruiter/company-settings?required=profile");
  }
  const query = await searchParams;
  return (
    <RecruiterRouteView
      view="list"
      initialData={data}
      initialTab={parseRecruiterJobPostingTab(query.tab)}
    />
  );
}
