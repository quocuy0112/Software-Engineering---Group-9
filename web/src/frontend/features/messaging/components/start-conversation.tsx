"use client";

import { useMemo, useState } from "react";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import { openConversation } from "../client/messaging-api";
import { MessagingAvatar } from "./messaging-avatar";

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
    <section className="messaging-start" role="dialog" aria-label="Start a conversation">
      <div className="messaging-section-heading">
        <div>
          <p className="messaging-section-eyebrow">NEW MESSAGE</p>
          <h2>Start a conversation</h2>
        </div>
        <span className="messaging-section-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </div>
      <label className="messaging-search-field">
        <span className="sr-only">Search eligible people</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          type="search"
          aria-label="Search eligible people"
          placeholder="Search eligible people"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {error ? (
        <p className="messaging-inline-alert" role="alert">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <div className="messaging-eligible-empty" role="status">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9.5" cy="7" r="4" />
              <path d="m17 8 4 4m0-4-4 4" />
            </svg>
          </span>
          <div>
            <strong>No connections yet</strong>
            <p>No eligible people are available to message.</p>
          </div>
        </div>
      ) : (
        <ul className="messaging-eligible-list" aria-label="Eligible people">
          {items.map((item) => (
            <li key={item.participant.id}>
              <MessagingAvatar
                name={item.participant.name}
                image={item.participant.image}
                size="small"
              />
              <div className="messaging-eligible-person">
                <strong>{item.participant.name}</strong>
                {item.contexts.length > 1 ? (
                  <label>
                    <span className="sr-only">Conversation context</span>
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
                ) : (
                  <span>{item.contexts[0]?.label}</span>
                )}
              </div>
              <button
                className="messaging-icon-button messaging-message-person"
                type="button"
                disabled={busyUserId === item.participant.id}
                aria-label={`Message ${item.participant.name}`}
                onClick={() => void open(item)}
              >
                {busyUserId === item.participant.id ? (
                  <span className="messaging-spinner" aria-hidden="true" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                )}
                <span className="sr-only">
                  {busyUserId === item.participant.id ? "Opening..." : "Message"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
