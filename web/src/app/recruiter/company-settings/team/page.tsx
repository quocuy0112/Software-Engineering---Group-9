import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CompanyTeamService } from "@/backend/company-members/company-team-service";
import { CompanyTeamScreen } from "@/frontend/features/recruiter-workspace/company-team-screen";
export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const c = await getWorkspaceContext();
  if (!c) redirect("/login?returnTo=%2Frecruiter%2Fcompany-settings%2Fteam");
  const query = searchParams ? await searchParams : {};
  const companyId = Array.isArray(query.companyId)
    ? query.companyId[0]
    : query.companyId;
  let team;
  try {
    team = await new CompanyTeamService().list(c.userId, companyId);
  } catch {
    redirect(
      companyId
        ? `/recruiter/company-settings?companyId=${encodeURIComponent(companyId)}`
        : "/recruiter/company-settings",
    );
  }
  return <CompanyTeamScreen {...team} companyId={companyId} />;
}
