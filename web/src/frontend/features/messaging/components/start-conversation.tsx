"use client";

import { useMemo, useState } from "react";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import { openConversation } from "../client/messaging-api";

export function StartConversation({
  csrfProof,
  initialItems,
  onOpened,
}: {
  csrfProof: string;
  initialItems: EligibleParticipant[];
  onOpened: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<Record<string, string>>({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? initialItems.filter((item) =>
          item.participant.name.toLocaleLowerCase().includes(normalized),
        )
      : initialItems;
  }, [initialItems, query]);

  async function open(item: EligibleParticipant) {
    const reference = selectedContexts[item.participant.id] ?? item.contexts[0]?.reference;
    const context = item.contexts.find((candidate) => candidate.reference === reference);
    if (!context) return;
    setBusyUserId(item.participant.id);
    setError(null);
    try {
      const conversation = await openConversation(
        {
          targetUserId: item.participant.id,
          context:
            context.type === "APPLICATION"
              ? { type: "APPLICATION", applicationId: context.reference }
              : {
                  type: "PROFESSIONAL_CONNECTION",
                  professionalConnectionId: context.reference,
                },
        },
        csrfProof,
      );
      onOpened(conversation.id);
    } catch {
      setError("The conversation could not be opened. Please try again.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section role="dialog" aria-label="Start a conversation">
      <h1>Messages</h1>
      <label>
        Search eligible people
        <input
          type="search"
          aria-label="Search eligible people"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {items.length === 0 ? (
        <p role="status">No eligible people are available to message.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.participant.id}>
              <span>{item.participant.name}</span>
              {item.contexts.length > 1 ? (
                <label>
                  Conversation context
                  <select
                    aria-label={`Conversation context for ${item.participant.name}`}
                    value={selectedContexts[item.participant.id] ?? item.contexts[0]?.reference}
                    onChange={(event) =>
                      setSelectedContexts((current) => ({
                        ...current,
                        [item.participant.id]: event.target.value,
                      }))
                    }
                  >
                    {item.contexts.map((context) => (
                      <option key={context.reference} value={context.reference}>
                        {context.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                disabled={busyUserId === item.participant.id}
                aria-label={`Message ${item.participant.name}`}
                onClick={() => void open(item)}
              >
                {busyUserId === item.participant.id ? "Opening..." : "Message"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
