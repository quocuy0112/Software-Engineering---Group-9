import { redirect } from "next/navigation";
import { getMessagingPageContext } from "@/backend/messaging/services/get-messaging-page-context";
import { MessagingWorkspace } from "@/frontend/features/messaging/components/messaging-workspace";
import "@/frontend/features/messaging/styles/messaging.css";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const context = await getMessagingPageContext();
  if (!context) redirect("/login?returnTo=%2Fmessages");
  const query = await searchParams;
  return (
    <MessagingWorkspace
      key={query.conversation ?? "conversation-list"}
      currentUserId={context.userId}
      csrfProof={context.csrfProof}
      initialEligibleParticipants={context.initialEligibleParticipants}
      initialConversations={context.initialConversations}
      initialConversationId={query.conversation ?? null}
    />
  );
}
