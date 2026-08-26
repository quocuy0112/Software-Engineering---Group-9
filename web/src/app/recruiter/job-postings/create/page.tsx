import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { readRecruiterJobManagementData } from "@/backend/services/jobs/recruiter-job-posting-data";
import { RecruiterRouteView } from "@/frontend/features/recruiter-workspace/recruiter-route-view";

export const dynamic = "force-dynamic";

export default async function RecruiterCreateJobPostingPage({
  searchParams,
}: {
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const context = await getWorkspaceContext();
  if (!context)
    redirect("/login?returnTo=%2Frecruiter%2Fjob-postings%2Fcreate");

  const data = await readRecruiterJobManagementData(context.userId);
  const query = searchParams ? await searchParams : {};
  const requestedCompanyId = Array.isArray(query.companyId)
    ? query.companyId[0]
    : query.companyId;
  const company =
    data.companies.find(
      (candidate) =>
        candidate.id === requestedCompanyId ||
        candidate.databaseId === requestedCompanyId,
    ) ??
    data.companies.find((candidate) => candidate.id === data.companyId) ??
    null;
  if (!company || company.profileComplete === false) {
    const companyQuery = company?.id
      ? `&companyId=${encodeURIComponent(company.id)}`
      : "";
    redirect(`/recruiter/company-settings?required=profile${companyQuery}`);
  }
  return (
    <RecruiterRouteView
      view="create"
      initialData={data}
      initialCompanyId={company.id}
    />
  );
}
