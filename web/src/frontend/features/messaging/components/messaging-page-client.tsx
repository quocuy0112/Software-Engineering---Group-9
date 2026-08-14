"use client";

import { useRouter } from "next/navigation";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
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
  const locale = useWorkspaceLocale();
  return (
    <main>
      <StartConversation
        csrfProof={csrfProof}
        initialItems={initialItems}
        locale={locale}
        onOpened={(conversationId) =>
          router.push(
            `/messages?conversation=${encodeURIComponent(conversationId)}`,
          )
        }
      />
    </main>
  );
}
