import "server-only";
import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";
import { FindEligibleParticipantsService } from "./find-eligible-participants";
import { ListConversationsService } from "./list-conversations";

export async function getMessagingPageContext() {
  const workspace = await getWorkspaceContext();
  if (!workspace) return null;
  const [eligible, conversations] = await Promise.all([
    new FindEligibleParticipantsService().execute({
      userId: workspace.userId,
      limit: 20,
    }),
    new ListConversationsService().execute({
      userId: workspace.userId,
      limit: 20,
    }),
  ]);
  return {
    userId: workspace.userId,
    csrfProof: workspace.csrfProof,
    initialEligibleParticipants: eligible.items,
    initialConversations: conversations.items,
  };
}
