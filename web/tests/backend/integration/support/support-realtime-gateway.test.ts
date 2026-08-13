import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attachSupportNamespace } from "@/backend/support/realtime/socket-io-support-gateway";
import type { SupportInvalidation } from "@/shared/contracts/support";
import { REALTIME_SOCKET_PATH } from "@/shared/contracts/realtime/socket-transport";

const publisherKey = Symbol.for("smarthire.support.realtime.publisher");
const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()));
  delete (process as unknown as Record<symbol, unknown>)[publisherKey];
  vi.resetModules();
});

function once(socket: Socket, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      3_000,
    );
    socket.once(event, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe("support realtime gateway", () => {
  it("delivers an admin invalidation to the candidate requester room", async () => {
    const server = createServer();
    const io = new Server(server, {
      path: REALTIME_SOCKET_PATH,
      transports: ["websocket"],
      allowUpgrades: false,
    });
    attachSupportNamespace(io, {
      authenticate: async (headers) => {
        const userId = headers.get("x-test-user") ?? "missing";
        return {
          userId,
          sessionId: `session-${userId}`,
          role:
            headers.get("x-test-role") === "admin"
              ? "ADMINISTRATOR"
              : "REQUESTER",
        };
      },
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    const url = `http://127.0.0.1:${address.port}/support`;
    const candidate = createClient(url, {
      path: REALTIME_SOCKET_PATH,
      transports: ["websocket"],
      extraHeaders: {
        "x-test-user": "candidate-1",
        "x-test-role": "requester",
      },
    });
    const admin = createClient(url, {
      path: REALTIME_SOCKET_PATH,
      transports: ["websocket"],
      extraHeaders: {
        "x-test-user": "admin-1",
        "x-test-role": "admin",
      },
    });
    cleanup.push(async () => {
      candidate.disconnect();
      admin.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (server.listening)
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });
    await Promise.all([once(candidate, "connect"), once(admin, "connect")]);
    await new Promise((resolve) => setTimeout(resolve, 25));

    vi.resetModules();
    const routeHub =
      await import("@/backend/support/realtime/support-realtime-hub");
    const event: SupportInvalidation = {
      caseId: "case-1",
      version: 4,
      state: "WAITING_FOR_USER",
      change: "MESSAGE_ADDED",
    };
    const candidateDelivery = once(candidate, "support:case:changed");
    const adminDelivery = once(admin, "support:case:changed");
    await routeHub.supportRealtimePublisher().publish(event, "candidate-1");

    await expect(candidateDelivery).resolves.toEqual(event);
    await expect(adminDelivery).resolves.toEqual(event);
  }, 10_000);
});
