import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { CandidateRecruitmentThread } from "@/frontend/features/recruitment-messaging/candidate-recruitment-thread";
import "@/frontend/features/recruitment-messaging/recruitment-messaging.css";

export const dynamic = "force-dynamic";

export default async function CandidateRecruitmentMessagesPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const context = await getWorkspaceContext();
  const { applicationId } = await params;
  if (!context) redirect(`/login?returnTo=${encodeURIComponent(`/jobs/applied/${applicationId}/messages`)}`);
  return <CandidateRecruitmentThread applicationId={applicationId} csrfProof={context.csrfProof} />;
}
