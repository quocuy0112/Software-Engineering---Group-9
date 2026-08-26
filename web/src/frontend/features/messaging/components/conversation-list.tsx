import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";
import { getJobContextLabel } from "../messaging-context";
import { messagingCopy } from "../messaging-copy";
import { MessagingAvatar } from "./messaging-avatar";

function formatConversationTime(value: string, locale: WorkspaceLocale) {
  const date = new Date(value);
  const now = new Date();
  const options =
    date.toDateString() === now.toDateString()
      ? ({ hour: "2-digit", minute: "2-digit" } as const)
      : ({ day: "2-digit", month: "2-digit" } as const);
  return new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-US",
    options,
  ).format(date);
}

export function ConversationList({
  currentUserId,
  items,
  selectedId,
  locale = "en",
  onSelect,
  onLoadMore,
  hasMore,
}: {
  currentUserId?: string;
  items: ConversationSummary[];
  selectedId: string | null;
  locale?: WorkspaceLocale;
  onSelect: (conversationId: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  const copy = messagingCopy(locale);
  return (
    <section className="messaging-recent">
      <div className="messaging-recent-heading">
        <div>
          <h2>{copy.recentConversations}</h2>
        </div>
        <span aria-label={`${items.length} ${copy.conversations}`}>
          {items.length}
        </span>
      </div>
      <nav
        aria-label={copy.recentConversations}
        className="messaging-conversation-list"
      >
        {items.length === 0 ? (
          <div className="messaging-conversation-empty">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </span>
            <strong>{copy.noConversations}</strong>
            <p>{copy.noConversationsDescription}</p>
          </div>
        ) : null}
        {items.map((conversation) => {
          const jobContextLabel = getJobContextLabel(conversation.context);
          const timestamp =
            conversation.lastMessage?.createdAt ?? conversation.createdAt;
          return (
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
                  <time dateTime={timestamp}>
                    {formatConversationTime(timestamp, locale)}
                  </time>
                </span>
                {jobContextLabel ? (
                  <span className="messaging-conversation-context">
                    {jobContextLabel}
                  </span>
                ) : null}
                <span className="messaging-conversation-preview">
                  {conversation.lastMessage
                    ? `${conversation.lastMessage.senderId === currentUserId ? copy.youPrefix : ""}${conversation.lastMessage.content}`
                    : copy.readyToChat}
                </span>
              </span>
              {conversation.unreadCount > 0 ? (
                <span
                  className="messaging-unread-indicator"
                  role="img"
                  aria-label={`${conversation.unreadCount} ${copy.unread}`}
                />
              ) : null}
            </button>
          );
        })}
        {hasMore ? (
          <button
            className="messaging-load-more"
            type="button"
            onClick={onLoadMore}
          >
            {copy.loadMore}
          </button>
        ) : null}
      </nav>
    </section>
  );
}
