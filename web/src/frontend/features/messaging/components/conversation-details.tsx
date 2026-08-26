import Link from "next/link";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";
import type { MessageHistoryPage } from "../client/use-message-history";
import {
  getConversationContextLabel,
  getJobContextLabel,
} from "../messaging-context";
import { MessagingAvatar } from "./messaging-avatar";

function formatConversationDate(value: string, locale: WorkspaceLocale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function ConversationDetails({
  page,
  locale,
  showDetails,
  items,
  selectedId,
  onSelect,
  onBack,
}: {
  page: MessageHistoryPage | null;
  locale: WorkspaceLocale;
  showDetails: boolean;
  items: ConversationSummary[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  onBack: () => void;
}) {
  if (!showDetails || !page) {
    return (
      <aside
        className="messaging-details messaging-details--recent"
        aria-label="Recent conversations"
      >
        <header>
          <div>
            <p>Conversations</p>
            <h2>Recent conversations</h2>
          </div>
          <span className="messaging-details__count">{items.length}</span>
        </header>
        <nav
          className="messaging-details__recent-list"
          aria-label="Recent conversations"
        >
          {items.length === 0 ? (
            <p>No recent conversations.</p>
          ) : (
            items.slice(0, 8).map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className="messaging-details__recent-card"
                data-selected={conversation.id === selectedId}
                onClick={() => onSelect(conversation.id)}
              >
                <strong>{conversation.otherParticipant.name}</strong>
                <span>
                  {getJobContextLabel(conversation.context) ??
                    getConversationContextLabel(conversation.context, locale)}
                </span>
                <time
                  dateTime={
                    conversation.lastMessage?.createdAt ??
                    conversation.createdAt
                  }
                >
                  {formatConversationDate(
                    conversation.lastMessage?.createdAt ??
                      conversation.createdAt,
                    locale,
                  )}
                </time>
              </button>
            ))
          )}
        </nav>
      </aside>
    );
  }

  const conversation = page.conversation;
  const contextLabel = getConversationContextLabel(conversation.context, locale);
  const jobContextLabel = getJobContextLabel(conversation.context);

  return (
    <aside
      className="messaging-details messaging-details--profile"
      aria-label="Conversation details"
    >
      <header>
        <button
          type="button"
          className="messaging-details__back"
          onClick={onBack}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Recent conversations
        </button>
        <MessagingAvatar
          name={conversation.otherParticipant.name}
          image={conversation.otherParticipant.image}
          size="large"
          presence={conversation.presence}
        />
        <div>
          <p>Conversation details</p>
          <h2>{conversation.otherParticipant.name}</h2>
        </div>
      </header>
      <section>
        <p className="messaging-details__label">Context</p>
        <strong>{jobContextLabel ?? contextLabel}</strong>
        {jobContextLabel ? <span>{contextLabel}</span> : null}
      </section>
      <section>
        <p className="messaging-details__label">Messaging access</p>
        <strong>Messaging available</strong>
        <span>Private messages are available only in this approved context.</span>
      </section>
      <Link
        className="messaging-details__profile-link"
        href={`/people/${encodeURIComponent(conversation.otherParticipant.id)}`}
      >
        View profile
      </Link>
    </aside>
  );
}
