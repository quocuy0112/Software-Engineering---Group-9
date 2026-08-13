import "server-only";
import type { Namespace, Server, Socket } from "socket.io";
import { ConnectionRequestBoundary } from "../authorization/connection-request-boundary";
import { AdminRequestBoundary } from "@/backend/security/admin-request-boundary";
import { configuredOrigins } from "@/backend/admin/origins";
import type {
  ConnectionClientToServerEvents,
  ConnectionInterServerEvents,
  ConnectionServerToClientEvents,
  ConnectionSocketData,
} from "@/shared/contracts/connections";
import { installConnectionRealtimePublisher } from "./connection-realtime-hub";

function headersFrom(raw: Record<string, string | string[] | undefined>) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

const room = (userId: string) => `connections:user:${userId}`;
const adminRoom = "connections:administrators";

export function attachConnectionNamespace(io: Server) {
  const namespace = io.of("/connections") as unknown as Namespace<
    ConnectionClientToServerEvents,
    ConnectionServerToClientEvents,
    ConnectionInterServerEvents,
    ConnectionSocketData
  >;
  installConnectionRealtimePublisher({
    publish(event, recipientUserIds) {
      for (const userId of new Set(recipientUserIds)) {
        namespace.to(room(userId)).emit("connection:changed", event);
      }
      namespace.to(adminRoom).emit("connection:changed", event);
    },
  });
  namespace.use(async (socket: Socket, next) => {
    try {
      const headers = headersFrom(socket.handshake.headers);
      const origin = headers.get("origin");
      const origins = configuredOrigins();
      const actor =
        origin === origins.admin
          ? await new AdminRequestBoundary().require(
              new Request(
                `${origins.admin}/api/admin/professional-connection-proposals`,
                { method: "GET", headers },
              ),
            )
          : await new ConnectionRequestBoundary().requireSocket(headers);
      socket.data.userId = actor.userId;
      socket.data.sessionId = actor.sessionId;
      socket.data.role =
        origin === origins.admin ? "ADMINISTRATOR" : "PARTICIPANT";
      next();
    } catch {
      next(new Error("AUTH_REQUIRED"));
    }
  });
  namespace.on("connection", async (socket) => {
    await socket.join(
      socket.data.role === "ADMINISTRATOR"
        ? adminRoom
        : room(socket.data.userId),
    );
  });
  return namespace;
}
