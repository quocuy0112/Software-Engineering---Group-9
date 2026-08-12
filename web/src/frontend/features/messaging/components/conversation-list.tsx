import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";
import { MessagingAvatar } from "./messaging-avatar";

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function ConversationList({
  currentUserId,
  items,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
}: {
  currentUserId?: string;
  items: ConversationSummary[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  return (
    <section className="messaging-recent">
      <div className="messaging-recent-heading">
        <div>
          <p className="messaging-section-eyebrow">INBOX</p>
          <h2>Recent conversations</h2>
        </div>
        <span aria-label={`${items.length} conversations`}>{items.length}</span>
      </div>
      <nav aria-label="Conversations" className="messaging-conversation-list">
        {items.length === 0 ? (
          <div className="messaging-conversation-empty">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </span>
            <strong>No conversations yet</strong>
            <p>Start a professional conversation above.</p>
          </div>
        ) : null}
        {items.map((conversation) => (
          <button
            className="messaging-conversation-card"
            type="button"
            key={conversation.id}
            aria-current={selectedId === conversation.id ? "page" : undefined}
            onClick={() => onSelect(conversation.id)}
          >
            <MessagingAvatar
              name={conversation.otherParticipant.name}
              image={conversation.otherParticipant.image}
              presence={conversation.presence}
            />
            <span className="messaging-conversation-copy">
              <span className="messaging-conversation-name-row">
                <strong>{conversation.otherParticipant.name}</strong>
                <time dateTime={conversation.lastMessage?.createdAt ?? conversation.createdAt}>
                  {formatConversationTime(
                    conversation.lastMessage?.createdAt ?? conversation.createdAt,
                  )}
                </time>
              </span>
              <span className="messaging-conversation-context">{conversation.context.label}</span>
              <span className="messaging-conversation-preview">
                {conversation.lastMessage
                  ? `${conversation.lastMessage.senderId === currentUserId ? "You: " : ""}${conversation.lastMessage.content}`
                  : "Conversation ready"}
              </span>
            </span>
            {conversation.unreadCount > 0 ? (
              <span
                className="messaging-unread-badge"
                aria-label={`${conversation.unreadCount} unread messages`}
              >
                {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
              </span>
            ) : null}
          </button>
        ))}
        {hasMore ? (
          <button className="messaging-load-more" type="button" onClick={onLoadMore}>
            Load more conversations
          </button>
        ) : null}
      </nav>
    </section>
  );
}
