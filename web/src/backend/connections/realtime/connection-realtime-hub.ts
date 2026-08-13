import "server-only";
import type { ConnectionRealtimePublisherPort } from "../ports/connection-realtime";

const noop: ConnectionRealtimePublisherPort = { publish: () => undefined };
let publisher: ConnectionRealtimePublisherPort = noop;

export function installConnectionRealtimePublisher(
  next: ConnectionRealtimePublisherPort,
) {
  publisher = next;
}

export function connectionRealtimePublisher() {
  return publisher;
}
