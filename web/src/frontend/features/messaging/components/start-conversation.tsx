"use client";

import { useEffect, useState } from "react";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import {
  findEligibleParticipants,
  openConversation,
} from "../client/messaging-api";
import { MessagingAvatar } from "./messaging-avatar";

const minimumSearchLength = 2;
const searchDebounceMs = 400;

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
  const [searchItems, setSearchItems] = useState<EligibleParticipant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedContexts, setSelectedContexts] = useState<
    Record<string, string>
  >({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const normalizedQuery = query.trim();
  const items = normalizedQuery
    ? normalizedQuery.length >= minimumSearchLength
      ? searchItems
      : []
    : initialItems;

  useEffect(() => {
    if (normalizedQuery.length < minimumSearchLength) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const result = await findEligibleParticipants(
          normalizedQuery,
          controller.signal,
        );
        if (!controller.signal.aborted) setSearchItems(result.items);
      } catch (error) {
        if (controller.signal.aborted) return;
        setSearchItems([]);
        setSearchError(
          error instanceof Error &&
            error.message === "ELIGIBLE_PARTICIPANTS_FAILED"
            ? "Eligible people could not be searched. Please try again."
            : "Search is temporarily unavailable.",
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, searchDebounceMs);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery]);

  function updateQuery(value: string) {
    const nextQuery = value.trim();
    setQuery(value);
    setSearching(nextQuery.length >= minimumSearchLength);
    setSearchError(null);
  }

  async function open(item: EligibleParticipant) {
    const reference =
      selectedContexts[item.participant.id] ?? item.contexts[0]?.reference;
    const context = item.contexts.find(
      (candidate) => candidate.reference === reference,
    );
    if (!context) return;
    setBusyUserId(item.participant.id);
    setOpenError(null);
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
      setOpenError("The conversation could not be opened. Please try again.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <section
      className="messaging-start"
      role="dialog"
      aria-label="Start a conversation"
    >
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
          placeholder="Enter name, email, or account ID"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
        />
      </label>
      {normalizedQuery.length === 1 ? (
        <p className="messaging-search-status" role="status">
          Enter at least 2 characters to search.
        </p>
      ) : null}
      {searching ? (
        <p className="messaging-search-status" role="status">
          Searching eligible people…
        </p>
      ) : null}
      {searchError ? (
        <p className="messaging-inline-alert" role="alert">
          {searchError}
        </p>
      ) : null}
      {openError ? (
        <p className="messaging-inline-alert" role="alert">
          {openError}
        </p>
      ) : null}
      {!searching &&
      !searchError &&
      normalizedQuery.length !== 1 &&
      items.length === 0 ? (
        <div className="messaging-eligible-empty" role="status">
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9.5" cy="7" r="4" />
              <path d="m17 8 4 4m0-4-4 4" />
            </svg>
          </span>
          <div>
            <strong>
              {normalizedQuery
                ? "No eligible messaging relationship"
                : "No eligible contacts yet"}
            </strong>
            <p>
              {normalizedQuery
                ? "Only accepted professional connections or application-related contacts can be messaged. Check the details or establish a connection first."
                : "Establish a professional connection or use an application context before starting a conversation."}
            </p>
          </div>
        </div>
      ) : !searching && items.length > 0 ? (
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
                      value={
                        selectedContexts[item.participant.id] ??
                        item.contexts[0]?.reference
                      }
                      onChange={(event) =>
                        setSelectedContexts((current) => ({
                          ...current,
                          [item.participant.id]: event.target.value,
                        }))
                      }
                    >
                      {item.contexts.map((context) => (
                        <option
                          key={context.reference}
                          value={context.reference}
                        >
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
                  {busyUserId === item.participant.id
                    ? "Opening..."
                    : "Message"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
