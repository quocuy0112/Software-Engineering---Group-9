import type { MessageHistoryPage } from "../client/use-message-history";
import { MessageComposer } from "./message-composer";
import { BlockParticipantDialog } from "./block-participant-dialog";
import { ReportMessagingDialog } from "./report-messaging-dialog";
import { ConversationHeader } from "./conversation-header";
import { useNotificationContextRead } from "@/frontend/features/notifications/client/use-notification-context-read";

export function MessageThread({
  currentUserId,
  page,
  error,
  onLoadOlder,
  onBack,
  csrfProof,
  onBlockedChanged,
}: {
  currentUserId?: string;
  page: MessageHistoryPage | null;
  error: string | null;
  onLoadOlder: () => void;
  onBack: () => void;
  csrfProof: string;
  onBlockedChanged: (blocked: boolean) => void;
}) {
  useNotificationContextRead({
    enabled: Boolean(page) && !error,
    contextType: "CONVERSATION",
    contextId: page?.conversation.id,
    csrfProof,
  });
  if (error)
    return (
      <section
        className="messaging-thread-state messaging-thread-error"
        role="alert"
      >
        <span aria-hidden="true">!</span>
        <h2>We could not load this conversation</h2>
        <p>{error}</p>
      </section>
    );
  if (!page)
    return (
      <section className="messaging-thread-state" role="status">
        <span className="messaging-thread-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
        </span>
        <h2>Your professional inbox</h2>
        <p>Select a conversation to read messages.</p>
        <small>
          Messages are private, durable, and protected by your SmartHire
          session.
        </small>
      </section>
    );
  return (
    <section
      className="messaging-thread"
      aria-label={`Conversation with ${page.conversation.otherParticipant.name}`}
    >
      <header className="messaging-thread-header">
        <button
          type="button"
          className="messaging-mobile-back messaging-icon-button"
          aria-label="Back to conversations"
          onClick={onBack}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="sr-only">Back to conversations</span>
        </button>
        <ConversationHeader
          name={page.conversation.otherParticipant.name}
          image={page.conversation.otherParticipant.image}
          contextLabel={page.conversation.context.label}
          presence={page.conversation.presence}
        />
        <div className="messaging-thread-actions">
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
        </div>
      </header>
      {page.conversation.accessMode === "READ_ONLY" ? (
        <p className="messaging-blocked-banner" role="status">
          This connection has ended. Retained conversation history is read-only.
        </p>
      ) : page.conversation.blocked ? (
        <p className="messaging-blocked-banner" role="status">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="m6 6 12 12" />
          </svg>
          Messaging is blocked. Existing history remains available.
        </p>
      ) : null}
      <div className="messaging-history">
        {page.nextCursor ? (
          <button
            className="messaging-load-older"
            type="button"
            onClick={onLoadOlder}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m8 12 4-4 4 4M12 8v9" />
            </svg>
            Load older messages
          </button>
        ) : (
          <p className="messaging-history-start">Start of conversation</p>
        )}
        <ol aria-label="Messages">
          {page.items.map((message) => {
            const outgoing = message.senderId === currentUserId;
            return (
              <li
                key={message.id}
                data-direction={outgoing ? "outgoing" : "incoming"}
              >
                <div className="messaging-message-bubble">
                  <p>{message.content}</p>
                  <span className="messaging-message-meta">
                    <time dateTime={message.createdAt}>
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(message.createdAt))}
                    </time>
                    {!currentUserId || outgoing ? (
                      <span className="messaging-delivery-state">
                        {message.delivery === "READ" ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="m2 13 4 4L14 9M10 17l2 2 10-10" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        )}
                        {message.delivery === "READ" ? "Read" : "Sent"}
                      </span>
                    ) : null}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <MessageComposer
        conversationId={page.conversation.id}
        disabled={
          page.conversation.blocked ||
          page.conversation.accessMode === "READ_ONLY"
        }
      />
    </section>
  );
}
