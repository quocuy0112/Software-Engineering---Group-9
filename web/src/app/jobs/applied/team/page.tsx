import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { TeamApplicationService } from "@/backend/services/company-members/team-application-service";
import { TeamApplicationStatus } from "@/frontend/features/candidate-company/team-application-status";
import { JobsWorkspace } from "@/frontend/features/jobs/components/jobs-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateTeamApplicationsPage() {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login?returnTo=%2Fjobs%2Fapplied%2Fteam");
  const result = await new TeamApplicationService().listCandidate(
    context.userId,
  );
  return (
    <JobsWorkspace>
      <TeamApplicationStatus initialApplications={result.items} />
    </JobsWorkspace>
  );
}
