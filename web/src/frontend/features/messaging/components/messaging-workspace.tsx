"use client";

import { useCallback, useMemo, useState } from "react";
import type { ConversationSummary, EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import { useConversations } from "../client/use-conversations";
import { useMessageHistory } from "../client/use-message-history";
import { useChatConnection } from "../client/use-chat-connection";
import { useChatEvents } from "../client/use-chat-events";
import { ConversationList } from "./conversation-list";
import { MessageThread } from "./message-thread";
import { StartConversation } from "./start-conversation";

export function MessagingWorkspace({
  currentUserId,
  csrfProof,
  initialConversations,
  initialEligibleParticipants,
  initialConversationId = null,
}: {
  currentUserId: string;
  csrfProof: string;
  initialConversations: ConversationSummary[];
  initialEligibleParticipants: EligibleParticipant[];
  initialConversationId?: string | null;
}) {
  const conversations = useConversations(initialConversations);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const history = useMessageHistory(selectedId, csrfProof);
  const {
    addMessage,
    loadOlder,
    refresh: refreshHistory,
    setPage,
    setPresence,
  } = history;
  const { loadMore, refresh: refreshConversations } = conversations;
  const purge = useCallback(
    (conversationId?: string) => {
      if (!conversationId || conversationId === selectedId) setPage(null);
    },
    [selectedId, setPage],
  );
  const connectionInput = useMemo(
    () => ({ onAuthoritativeRefetch: refreshConversations, onProtectedCachePurge: purge }),
    [purge, refreshConversations],
  );
  const connectionState = useChatConnection(connectionInput);
  const onMessage = useCallback(
    (message: Parameters<typeof addMessage>[0]) => {
      addMessage(message);
      void refreshConversations();
    },
    [addMessage, refreshConversations],
  );
  const onRead = useCallback(() => void refreshHistory(), [refreshHistory]);
  const onAccessRevoked = useCallback(
    (conversationId: string) => {
      purge(conversationId);
      void refreshConversations();
    },
    [purge, refreshConversations],
  );
  const onPresence = useCallback(
    (event: { userId: string; presence: "ONLINE" | "OFFLINE" }) =>
      setPresence(event.userId, event.presence),
    [setPresence],
  );
  const eventInput = useMemo(
    () => ({ onMessage, onRead, onAccessRevoked, onPresence }),
    [onAccessRevoked, onMessage, onPresence, onRead],
  );
  useChatEvents(eventInput);

  return (
    <main className="messaging-workspace" data-thread-open={Boolean(selectedId)}>
      <header className="messaging-heading">
        <div>
          <p className="workspace-kicker">PROFESSIONAL COMMUNICATION</p>
          <h1 id="workspace-page-title">Messages</h1>
          <p className="messaging-heading-copy">
            Stay connected with candidates and hiring teams in one secure workspace.
          </p>
        </div>
        <span
          className="messaging-connection-status"
          data-state={connectionState.toLocaleLowerCase()}
          role="status"
        >
          <span aria-hidden="true" />
          {connectionState === "CONNECTED"
            ? "Realtime connected"
            : connectionState === "CONNECTING"
              ? "Connecting"
              : connectionState === "RECONNECTING"
                ? "Reconnecting"
                : "Offline"}
        </span>
      </header>
      {conversations.error ? (
        <p className="messaging-page-alert" role="alert">
          {conversations.error}
        </p>
      ) : null}
      <div className="messaging-grid">
        <aside className="messaging-sidebar" aria-label="Messaging navigation">
          <StartConversation
            csrfProof={csrfProof}
            initialItems={initialEligibleParticipants}
            onOpened={(conversationId) => {
              setSelectedId(conversationId);
              void refreshConversations();
            }}
          />
          <ConversationList
            currentUserId={currentUserId}
            items={conversations.items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLoadMore={() => void loadMore()}
            hasMore={Boolean(conversations.nextCursor)}
          />
        </aside>
        <MessageThread
          currentUserId={currentUserId}
          csrfProof={csrfProof}
          page={history.page}
          error={history.error}
          onLoadOlder={() => void loadOlder()}
          onBack={() => setSelectedId(null)}
          onBlockedChanged={() => {
            void refreshHistory();
            void refreshConversations();
          }}
        />
      </div>
    </main>
  );
}
