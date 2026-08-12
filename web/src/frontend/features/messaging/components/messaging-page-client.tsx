"use client";

import { useRouter } from "next/navigation";
import type { EligibleParticipant } from "@/shared/contracts/messaging/conversations";
import { StartConversation } from "./start-conversation";

export function MessagingPageClient({
  csrfProof,
  initialItems,
}: {
  csrfProof: string;
  initialItems: EligibleParticipant[];
}) {
  const router = useRouter();
  return (
    <main>
      <StartConversation
        csrfProof={csrfProof}
        initialItems={initialItems}
        onOpened={(conversationId) =>
          router.push(`/messages?conversation=${encodeURIComponent(conversationId)}`)
        }
      />
    </main>
  );
}
