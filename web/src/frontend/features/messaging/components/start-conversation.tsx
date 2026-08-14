"use client";

import { useState } from "react";
import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import { getConversationContextLabel } from "../messaging-context";
import { messagingCopy } from "../messaging-copy";
import { openConversation } from "../client/messaging-api";
import { MessagingAvatar } from "./messaging-avatar";

/**
 * This deliberately lists only relationships the server already marked eligible.
 * Free-form account lookup was removed from the Messages UI: conversations may
 * begin from an application or an accepted professional connection.
 */
export function StartConversation({
  csrfProof,
  initialItems,
  onOpened,
  locale = "en",
}: {
  csrfProof: string;
  initialItems: EligibleParticipant[];
  onOpened: (conversationId: string) => void;
  locale?: WorkspaceLocale;
}) {
  const copy = messagingCopy(locale);
  const [selectedContexts, setSelectedContexts] = useState<
    Record<string, string>
  >({});
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

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
      setOpenError(copy.openConversationError);
    } finally {
      setBusyUserId(null);
    }
  }

  if (initialItems.length === 0) return null;
  return (
    <section
      className="messaging-start"
      aria-labelledby="messaging-contacts-title"
    >
      <div className="messaging-section-heading">
        <div>
          <p className="messaging-section-eyebrow">{copy.eligibleKicker}</p>
          <h2 id="messaging-contacts-title">{copy.eligiblePeople}</h2>
        </div>
        <span className="messaging-section-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
        </span>
      </div>
      {openError ? (
        <p className="messaging-inline-alert" role="alert">
          {openError}
        </p>
      ) : null}
      <ul className="messaging-eligible-list" aria-label={copy.eligiblePeople}>
        {initialItems.map((item) => {
          const selectedReference =
            selectedContexts[item.participant.id] ??
            item.contexts[0]?.reference;
          const selectedContext = item.contexts.find(
            (context) => context.reference === selectedReference,
          );
          const busy = busyUserId === item.participant.id;
          return (
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
                    <span className="sr-only">{copy.conversationContext}</span>
                    <select
                      aria-label={`${copy.conversationContext}: ${item.participant.name}`}
                      value={selectedReference}
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
                          {getConversationContextLabel(context, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : selectedContext ? (
                  <span>
                    {getConversationContextLabel(selectedContext, locale)}
                  </span>
                ) : null}
              </div>
              <button
                className="messaging-icon-button messaging-message-person"
                type="button"
                disabled={busy}
                aria-label={`${copy.messagePerson} ${item.participant.name}`}
                onClick={() => void open(item)}
              >
                {busy ? (
                  <span className="messaging-spinner" aria-hidden="true" />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                )}
                <span className="sr-only">
                  {busy ? copy.opening : copy.message}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
