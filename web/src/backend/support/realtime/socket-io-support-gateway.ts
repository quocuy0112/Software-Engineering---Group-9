import "server-only";
import type { Namespace, Server, Socket } from "socket.io";
import { configuredOrigins } from "@/backend/admin/origins";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { SupportRequestBoundary } from "@/backend/support/authorization/support-request-boundary";
import type {
  SupportClientToServerEvents,
  SupportInterServerEvents,
  SupportServerToClientEvents,
  SupportSocketData,
} from "@/shared/contracts/support";
import {
  installSupportRealtimePublisher,
  type SupportRealtimePublisherPort,
} from "./support-realtime-hub";

function handshakeHeaders(raw: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

function requesterRoom(userId: string) {
  return `support:requester:${userId}`;
}

const adminRoom = "support:administrators";

type SupportNamespaceDependencies = {
  authenticate?: (headers: Headers) => Promise<SupportSocketData>;
};

async function authenticateSupportSocket(
  headers: Headers,
): Promise<SupportSocketData> {
  const origin = headers.get("origin");
  const origins = configuredOrigins();
  if (origin === origins.candidate) {
    const actor = await new SupportRequestBoundary().requireSocket(headers);
    return { ...actor, role: "REQUESTER" };
  }
  if (origin === origins.admin) {
    const request = new Request(`${origins.admin}/api/admin/support-cases`, {
      method: "GET",
      headers,
    });
    const actor = await new AdminRequestBoundary().require(request);
    return {
      userId: actor.userId,
      sessionId: actor.sessionId,
      role: "ADMINISTRATOR",
    };
  }
  throw new Error("AUTH_REQUIRED");
}

export function attachSupportNamespace(
  io: Server,
  supplied: SupportNamespaceDependencies = {},
) {
  const support = io.of("/support") as unknown as Namespace<
    SupportClientToServerEvents,
    SupportServerToClientEvents,
    SupportInterServerEvents,
    SupportSocketData
  >;
  const publisher: SupportRealtimePublisherPort = {
    publish(event, requesterUserId) {
      support
        .to(requesterRoom(requesterUserId))
        .emit("support:case:changed", event);
      support.to(adminRoom).emit("support:case:changed", event);
    },
  };
  installSupportRealtimePublisher(publisher);
  const authenticate = supplied.authenticate ?? authenticateSupportSocket;

  support.use(
    async (
      socket: Socket<
        SupportClientToServerEvents,
        SupportServerToClientEvents,
        SupportInterServerEvents,
        SupportSocketData
      >,
      next,
    ) => {
      try {
        const headers = handshakeHeaders(socket.handshake.headers);
        socket.data = await authenticate(headers);
        next();
      } catch {
        next(new Error("AUTH_REQUIRED"));
      }
    },
  );

  support.on("connection", async (socket) => {
    if (socket.data.role === "ADMINISTRATOR") await socket.join(adminRoom);
    else await socket.join(requesterRoom(socket.data.userId));
  });

  return support;
}
