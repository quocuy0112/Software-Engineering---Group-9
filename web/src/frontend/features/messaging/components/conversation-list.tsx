import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";

export function ConversationList({
  items,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
}: {
  items: ConversationSummary[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  return (
    <nav aria-label="Conversations" className="messaging-conversation-list">
      {items.length === 0 ? <p>No conversations yet.</p> : null}
      {items.map((conversation) => (
        <button
          type="button"
          key={conversation.id}
          aria-current={selectedId === conversation.id ? "page" : undefined}
          onClick={() => onSelect(conversation.id)}
        >
          <strong>{conversation.otherParticipant.name}</strong>
          <span>{conversation.lastMessage?.content ?? conversation.context.label}</span>
          {conversation.unreadCount > 0 ? (
            <span aria-label={`${conversation.unreadCount} unread messages`}>
              {conversation.unreadCount}
            </span>
          ) : null}
        </button>
      ))}
      {hasMore ? (
        <button type="button" onClick={onLoadMore}>
          Load more conversations
        </button>
      ) : null}
    </nav>
  );
}
