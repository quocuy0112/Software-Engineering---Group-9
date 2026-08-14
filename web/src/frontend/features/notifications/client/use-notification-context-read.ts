"use client";

import { useEffect, useRef } from "react";
import type { NotificationContextType } from "@/shared/contracts/notifications";

export const NOTIFICATION_CHANGED_EVENT = "smarthire:notifications-changed";

export function useNotificationContextRead(input: {
  enabled: boolean;
  contextType: NotificationContextType;
  contextId?: string | null;
  csrfProof: string;
}) {
  const completedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!input.enabled || !input.contextId || !input.csrfProof) return;
    const key = `${input.contextType}:${input.contextId}`;
    if (completedKey.current === key) return;
    const controller = new AbortController();

    void fetch("/api/notifications/contexts/read", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-csrf-token": input.csrfProof,
      },
      body: JSON.stringify({
        contextType: input.contextType,
        contextId: input.contextId,
      }),
    })
      .then((response) => {
        if (!response.ok || controller.signal.aborted) return;
        completedKey.current = key;
        window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [input.csrfProof, input.contextId, input.contextType, input.enabled]);
}
