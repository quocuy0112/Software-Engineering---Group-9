"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ConnectionClientToServerEvents,
  ConnectionServerToClientEvents,
} from "@/shared/contracts/connections";

let socket: Socket<
  ConnectionServerToClientEvents,
  ConnectionClientToServerEvents
> | null = null;

export function getConnectionSocket() {
  socket ??= io("/connections", {
    path: "/socket.io",
    transports: ["websocket"],
    upgrade: false,
    autoConnect: false,
    withCredentials: true,
  });
  return socket;
}
