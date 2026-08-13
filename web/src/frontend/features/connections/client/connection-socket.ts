"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ConnectionClientToServerEvents,
  ConnectionServerToClientEvents,
} from "@/shared/contracts/connections";
import { REALTIME_SOCKET_PATH } from "@/shared/contracts/realtime/socket-transport";

let socket: Socket<
  ConnectionServerToClientEvents,
  ConnectionClientToServerEvents
> | null = null;

export function getConnectionSocket() {
  socket ??= io("/connections", {
    path: REALTIME_SOCKET_PATH,
    transports: ["websocket"],
    upgrade: false,
    autoConnect: false,
    withCredentials: true,
  });
  return socket;
}
