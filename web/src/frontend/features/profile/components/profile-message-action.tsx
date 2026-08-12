"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EligibleContext } from "@/shared/contracts/messaging/common";
import { openConversation } from "@/frontend/features/messaging/client/messaging-api";

export function ProfileMessageAction({
  csrfProof,
  participantId,
  participantName,
  contexts,
}: {
  csrfProof: string;
  participantId: string;
  participantName: string;
  contexts: EligibleContext[];
}) {
  const router = useRouter();
  const [reference, setReference] = useState(contexts[0]?.reference ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const context = contexts.find((candidate) => candidate.reference === reference);
    if (!context) return;
    setBusy(true);
    setError(null);
    try {
      const conversation = await openConversation(
        {
          targetUserId: participantId,
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
      router.push(`/messages?conversation=${encodeURIComponent(conversation.id)}`);
    } catch {
      setError("Messaging is not currently available for this profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {contexts.length > 1 ? (
        <label>
          Conversation context
          <select value={reference} onChange={(event) => setReference(event.target.value)}>
            {contexts.map((context) => (
              <option value={context.reference} key={context.reference}>
                {context.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        disabled={busy || contexts.length === 0}
        aria-label={`Message ${participantName}`}
        onClick={() => void start()}
      >
        {busy ? "Opening conversation..." : "Message"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
