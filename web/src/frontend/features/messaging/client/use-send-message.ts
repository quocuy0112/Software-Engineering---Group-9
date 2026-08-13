"use client";

import { useCallback, useState } from "react";
import type { MessagingMessage } from "@/shared/contracts/messaging/messages";
import { getChatSocket } from "./chat-socket";

export type LocalMessage = {
  clientOperationId: string;
  content: string;
  status: "PENDING" | "SENT" | "FAILED";
  message: MessagingMessage | null;
};

export function useSendMessage(conversationId: string) {
  const [outbox, setOutbox] = useState<LocalMessage[]>([]);

  const send = useCallback(
    async (content: string, operationId = crypto.randomUUID()) => {
      setOutbox((current) => [
        ...current.filter((item) => item.clientOperationId !== operationId),
        { clientOperationId: operationId, content, status: "PENDING", message: null },
      ]);
      try {
        const acknowledgement = await getChatSocket().emitWithAck("message:send", {
          conversationId,
          clientOperationId: operationId,
          content,
        });
        if (!acknowledgement.ok) throw new Error(acknowledgement.error.code);
        setOutbox((current) =>
          current.map((item) =>
            item.clientOperationId === operationId
              ? {
                  ...item,
                  content: acknowledgement.data.message.content,
                  status: "SENT",
                  message: acknowledgement.data.message,
                }
              : item,
          ),
        );
        return acknowledgement.data.message;
      } catch {
        setOutbox((current) =>
          current.map((item) =>
            item.clientOperationId === operationId
              ? { ...item, status: "FAILED" }
              : item,
          ),
        );
        return null;
      }
    },
    [conversationId],
  );

  return { outbox, send };
}
