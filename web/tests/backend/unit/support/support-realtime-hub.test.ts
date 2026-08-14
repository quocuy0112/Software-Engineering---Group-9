import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupportInvalidation } from "@/shared/contracts/support";

const publisherKey = Symbol.for("smarthire.support.realtime.publisher");
const event: SupportInvalidation = {
  caseId: "support-case-1",
  version: 2,
  state: "WAITING_FOR_USER",
  change: "MESSAGE_ADDED",
};

afterEach(() => {
  delete (process as unknown as Record<symbol, unknown>)[publisherKey];
  vi.resetModules();
});

describe("support realtime hub", () => {
  it("shares the installed publisher across isolated module graphs", async () => {
    const firstHub =
      await import("@/backend/support/realtime/support-realtime-hub");
    const publish = vi.fn();
    firstHub.installSupportRealtimePublisher({ publish });
    expect(
      (process as unknown as Record<symbol, unknown>)[publisherKey],
    ).toEqual({ publish });

    vi.resetModules();
    const apiRouteHub =
      await import("@/backend/support/realtime/support-realtime-hub");
    await apiRouteHub.supportRealtimePublisher().publish(event, "requester-1");

    expect(publish).toHaveBeenCalledWith(event, "requester-1");
  });

  it("remains safe before the socket gateway is installed", async () => {
    const hub = await import("@/backend/support/realtime/support-realtime-hub");

    expect(
      hub.supportRealtimePublisher().publish(event, "requester-1"),
    ).toBeUndefined();
  });
});
