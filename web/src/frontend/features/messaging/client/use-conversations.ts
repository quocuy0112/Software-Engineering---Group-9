"use client";

import { useCallback, useState } from "react";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";
import { messagingCopy } from "../messaging-copy";

export function useConversations(
  initialItems: ConversationSummary[],
  locale: WorkspaceLocale = "en",
) {
  const copy = messagingCopy(locale);
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/messaging/conversations?limit=20", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("LIST_FAILED");
      const page = (await response.json()) as {
        items: ConversationSummary[];
        nextCursor: string | null;
      };
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch {
      setError(copy.conversationRefreshError);
    }
  }, [copy.conversationRefreshError]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const response = await fetch(
      `/api/messaging/conversations?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!response.ok) {
      setError(copy.olderConversationsError);
      return;
    }
    const page = (await response.json()) as {
      items: ConversationSummary[];
      nextCursor: string | null;
    };
    setItems((current) => [
      ...current,
      ...page.items.filter(
        (item) => !current.some((row) => row.id === item.id),
      ),
    ]);
    setNextCursor(page.nextCursor);
  }, [copy.olderConversationsError, nextCursor]);

  const clearUnread = useCallback((conversationId: string) => {
    setItems((current) =>
      current.map((conversation) =>
        conversation.id === conversationId && conversation.unreadCount > 0
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
  }, []);

  const setPresence = useCallback(
    (userId: string, presence: "ONLINE" | "OFFLINE") => {
      setItems((current) =>
        current.map((conversation) =>
          conversation.otherParticipant.id === userId
            ? { ...conversation, presence }
            : conversation,
        ),
      );
    },
    [],
  );

  return {
    items,
    setItems,
    nextCursor,
    error,
    refresh,
    loadMore,
    clearUnread,
    setPresence,
  };
}
