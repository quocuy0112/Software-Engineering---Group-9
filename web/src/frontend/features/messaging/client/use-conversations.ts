"use client";

import { useCallback, useState } from "react";
import type { ConversationSummary } from "@/shared/contracts/messaging/conversations";

export function useConversations(initialItems: ConversationSummary[]) {
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
      setError("Conversations could not be refreshed.");
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const response = await fetch(
      `/api/messaging/conversations?limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    if (!response.ok) return setError("Older conversations could not be loaded.");
    const page = (await response.json()) as {
      items: ConversationSummary[];
      nextCursor: string | null;
    };
    setItems((current) => [
      ...current,
      ...page.items.filter((item) => !current.some((row) => row.id === item.id)),
    ]);
    setNextCursor(page.nextCursor);
  }, [nextCursor]);

  return { items, setItems, nextCursor, error, refresh, loadMore };
}
