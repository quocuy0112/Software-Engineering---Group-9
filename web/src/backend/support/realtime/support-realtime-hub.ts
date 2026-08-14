import "server-only";
import type { SupportInvalidation } from "@/shared/contracts/support";

export interface SupportRealtimePublisherPort {
  publish(
    event: SupportInvalidation,
    requesterUserId: string,
  ): void | Promise<void>;
}

const noop: SupportRealtimePublisherPort = { publish: () => undefined };
const publisherKey = Symbol.for("smarthire.support.realtime.publisher");
type SupportRuntime = NodeJS.Process & {
  [publisherKey]?: SupportRealtimePublisherPort;
};

export function installSupportRealtimePublisher(
  next: SupportRealtimePublisherPort,
) {
  (process as SupportRuntime)[publisherKey] = next;
}

export function supportRealtimePublisher(): SupportRealtimePublisherPort {
  return (process as SupportRuntime)[publisherKey] ?? noop;
}
