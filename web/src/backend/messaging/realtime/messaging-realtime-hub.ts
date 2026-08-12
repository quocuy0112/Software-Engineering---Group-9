import "server-only";
import type { MessagingRealtimePublisherPort } from "@/backend/messaging/ports/realtime-publisher";
import type { ReadBoundary } from "@/shared/contracts/messaging/messages";
import type { MessagingAccessRevocationCause } from "@/backend/messaging/ports/realtime-publisher";

const publisherKey = Symbol.for("smarthire.messaging.realtime.publisher");
type MessagingRuntime = typeof globalThis & {
  [publisherKey]?: MessagingRealtimePublisherPort;
};

function currentPublisher() {
  return (globalThis as MessagingRuntime)[publisherKey] ?? null;
}

export function installMessagingRealtimePublisher(
  nextPublisher: MessagingRealtimePublisherPort,
) {
  (globalThis as MessagingRuntime)[publisherKey] = nextPublisher;
}

export async function publishCommittedRead(boundary: ReadBoundary) {
  await currentPublisher()?.publishRead(boundary);
}

export async function admitActiveMessagingConversationSockets(input: {
  conversationId: string;
  userIds: string[];
}) {
  await currentPublisher()?.admitConversationSockets(input);
}

export async function revokeMessagingConversationAccess(input: {
  affectedUserIds: string[];
  affectedSessionIds?: string[];
  affectedConversationIds: string[];
  cause: MessagingAccessRevocationCause;
  correlationId: string;
}) {
  await currentPublisher()?.revokeConversationAccess(input);
}
