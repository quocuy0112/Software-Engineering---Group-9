import "server-only";
import type { SupportInvalidation } from "@/shared/contracts/support";

export interface SupportRealtimePublisherPort {
  publish(
    event: SupportInvalidation,
    requesterUserId: string,
  ): void | Promise<void>;
}

const noop: SupportRealtimePublisherPort = { publish: () => undefined };
let publisher: SupportRealtimePublisherPort = noop;

export function installSupportRealtimePublisher(
  next: SupportRealtimePublisherPort,
) {
  publisher = next;
}

export function supportRealtimePublisher(): SupportRealtimePublisherPort {
  return publisher;
}
