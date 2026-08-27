import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import {
  TeamApplicationOwnerError,
  TeamApplicationOwnerService,
} from "@/backend/services/company-members/team-application-owner-service";
import { CompanyTeamApplicationsScreen } from "@/frontend/features/recruiter-workspace/company-team-applications-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ companyId?: string | string[] }>;
}) {
  const context = await getWorkspaceContext();
  if (!context)
    redirect(
      "/login?returnTo=%2Frecruiter%2Fcompany-settings%2Fteam%2Fapplications",
    );
  const query = searchParams ? await searchParams : {};
  const companyId = Array.isArray(query.companyId)
    ? query.companyId[0]
    : query.companyId;
  let result;
  try {
    result = await new TeamApplicationOwnerService().list(
      context.userId,
      companyId,
    );
  } catch (error) {
    if (error instanceof TeamApplicationOwnerError) {
      redirect(
        companyId
          ? `/recruiter/company-settings?companyId=${encodeURIComponent(companyId)}`
          : "/recruiter/company-settings",
      );
    }
    throw error;
  }
  return (
    <CompanyTeamApplicationsScreen
      initialApplications={result.items}
      companyId={companyId}
    />
  );
}
