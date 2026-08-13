import type {
  ConversationDetail,
  EligibleParticipant,
  OpenConversationInput,
} from "@/shared/contracts/messaging/conversations";
import type { MessagingReportInput } from "@/shared/contracts/messaging/safety";

export async function openConversation(
  input: OpenConversationInput,
  csrfProof: string,
): Promise<ConversationDetail> {
  const response = await fetch("/api/messaging/conversations", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-csrf-proof": csrfProof,
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("CONVERSATION_OPEN_FAILED");
  return response.json() as Promise<ConversationDetail>;
}

export async function findEligibleParticipants(q = "", signal?: AbortSignal) {
  const search = new URLSearchParams();
  if (q.trim()) search.set("q", q.trim());
  const response = await fetch(
    `/api/messaging/eligible-participants?${search}`,
    {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    },
  );
  if (!response.ok) throw new Error("ELIGIBLE_PARTICIPANTS_FAILED");
  return response.json() as Promise<{
    items: EligibleParticipant[];
    nextCursor: string | null;
  }>;
}

export async function submitMessagingReport(
  input: MessagingReportInput,
  csrfProof: string,
) {
  const response = await fetch("/api/messaging/reports", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-csrf-proof": csrfProof,
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("MESSAGING_REPORT_FAILED");
  return response.json() as Promise<{ receipt: "REPORT_RECEIVED" }>;
}
