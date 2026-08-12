"use client";

import { useState } from "react";
import { messageContentSchema } from "@/shared/contracts/messaging/messages";
import { useSendMessage } from "../client/use-send-message";

export function MessageComposer({
  conversationId,
  disabled = false,
}: {
  conversationId: string;
  disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const { outbox, send } = useSendMessage(conversationId);

  async function submit() {
    const parsed = messageContentSchema.safeParse(content);
    if (!parsed.success) {
      setValidation("Enter between 1 and 2,000 characters.");
      return;
    }
    setValidation(null);
    setContent("");
    await send(parsed.data);
  }

  return (
    <section aria-label="Message composer">
      <label>
        Message
        <textarea
          value={content}
          maxLength={2_000}
          disabled={disabled}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <button type="button" disabled={disabled} onClick={() => void submit()}>
        Send
      </button>
      {validation ? <p role="alert">{validation}</p> : null}
      <ul aria-label="Outgoing messages">
        {outbox.map((item) => (
          <li key={item.clientOperationId} data-status={item.status}>
            <span>{item.content}</span>
            <span>{item.status.toLocaleLowerCase()}</span>
            {item.status === "FAILED" ? (
              <button type="button" onClick={() => void send(item.content, item.clientOperationId)}>
                Retry
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
