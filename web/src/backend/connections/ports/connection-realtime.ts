import type { ConnectionInvalidation } from "@/shared/contracts/connections";

export interface ConnectionRealtimePublisherPort {
  publish(
    event: ConnectionInvalidation,
    recipientUserIds: string[],
  ): void | Promise<void>;
}
