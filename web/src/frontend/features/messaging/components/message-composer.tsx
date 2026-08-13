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
    <section className="messaging-composer" aria-label="Message composer">
      <ul className="messaging-outbox" aria-label="Outgoing messages">
        {outbox.map((item) => (
          <li
            key={item.clientOperationId}
            data-status={item.status.toLocaleLowerCase()}
          >
            <span className="messaging-outbox-copy">{item.content}</span>
            <span className="messaging-outbox-status">
              {item.status === "PENDING" ? (
                <span className="messaging-spinner" aria-hidden="true" />
              ) : null}
              {item.status.toLocaleLowerCase()}
            </span>
            {item.status === "FAILED" ? (
              <button
                type="button"
                onClick={() => void send(item.content, item.clientOperationId)}
              >
                Retry
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="messaging-composer-field">
          <span className="sr-only">Message</span>
          <textarea
            aria-label="Message"
            placeholder={
              disabled ? "This conversation is read-only" : "Write a message..."
            }
            value={content}
            maxLength={2_000}
            disabled={disabled}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                event.shiftKey ||
                event.nativeEvent.isComposing
              )
                return;
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }}
          />
          <span className="messaging-character-count" aria-live="polite">
            {content.length}/2,000
          </span>
        </label>
        <button
          className="messaging-send-button"
          type="submit"
          disabled={disabled}
        >
          <span>Send</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />
          </svg>
        </button>
      </form>
      <p className="messaging-composer-hint">
        Press Enter to send · Shift + Enter for a new line
      </p>
      {validation ? (
        <p className="messaging-inline-alert" role="alert">
          {validation}
        </p>
      ) : null}
    </section>
  );
}
