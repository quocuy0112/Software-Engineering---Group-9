import type { MessageHistoryPage } from "../client/use-message-history";
import { MessageComposer } from "./message-composer";
import { BlockParticipantDialog } from "./block-participant-dialog";
import { ReportMessagingDialog } from "./report-messaging-dialog";
import { ConversationHeader } from "./conversation-header";

export function MessageThread({
  page,
  error,
  onLoadOlder,
  onBack,
  csrfProof,
  onBlockedChanged,
}: {
  page: MessageHistoryPage | null;
  error: string | null;
  onLoadOlder: () => void;
  onBack: () => void;
  csrfProof: string;
  onBlockedChanged: (blocked: boolean) => void;
}) {
  if (error) return <p role="alert">{error}</p>;
  if (!page) return <p role="status">Select a conversation to read messages.</p>;
  return (
    <section className="messaging-thread" aria-label={`Conversation with ${page.conversation.otherParticipant.name}`}>
      <header>
        <button type="button" className="messaging-mobile-back" onClick={onBack}>
          Back to conversations
        </button>
        <ConversationHeader
          name={page.conversation.otherParticipant.name}
          contextLabel={page.conversation.context.label}
          presence={page.conversation.presence}
        />
        <BlockParticipantDialog
          csrfProof={csrfProof}
          targetUserId={page.conversation.otherParticipant.id}
          targetName={page.conversation.otherParticipant.name}
          blocked={page.conversation.blocked}
          onChanged={onBlockedChanged}
        />
        <ReportMessagingDialog
          csrfProof={csrfProof}
          conversationId={page.conversation.id}
          targetUserId={page.conversation.otherParticipant.id}
          messages={page.items}
        />
      </header>
      {page.conversation.blocked ? (
        <p role="status">Messaging is blocked. Existing history remains available.</p>
      ) : null}
      {page.nextCursor ? (
        <button type="button" onClick={onLoadOlder}>
          Load older messages
        </button>
      ) : null}
      <ol aria-label="Messages">
        {page.items.map((message) => (
          <li key={message.id} data-sender={message.senderId}>
            <p>{message.content}</p>
            <span>{message.delivery === "READ" ? "Read" : "Sent"}</span>
          </li>
        ))}
      </ol>
      <MessageComposer conversationId={page.conversation.id} disabled={page.conversation.blocked} />
    </section>
  );
}
