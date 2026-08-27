import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CompanyDiscoveryAuthorizationError } from "@/backend/services/companies/company-discovery-authorization";
import { CompanyDiscoveryService } from "@/backend/services/companies/company-discovery-service";
import { TeamApplicationForm } from "@/frontend/features/candidate-company/team-application-form";
import { teamRoleSchema } from "@/shared/contracts/company-members/team-applications";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeamApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<{ role?: string | string[] }>;
}) {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fcompany");
  const { companyId } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedRole = Array.isArray(query.role) ? query.role[0] : query.role;

  let company;
  try {
    company = await new CompanyDiscoveryService().detail(
      companyId,
      {
        kind: "user",
        userId: context.userId,
        sessionId: context.sessionId,
      },
      {},
    );
  } catch (error) {
    if (error instanceof CompanyDiscoveryAuthorizationError) notFound();
    throw error;
  }
  const selectedRole = teamRoleSchema.safeParse(requestedRole).data;
  const role =
    selectedRole && company.teamRoles.includes(selectedRole)
      ? selectedRole
      : company.teamRoles[0];
  if (!role) notFound();
  return (
    <TeamApplicationForm
      companyId={company.companyId}
      companyName={company.name}
      teamRoles={company.teamRoles}
      initialRole={role}
    />
  );
}
