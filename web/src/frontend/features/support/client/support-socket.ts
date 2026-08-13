"use client";

import { io, type Socket } from "socket.io-client";
import type {
  SupportClientToServerEvents,
  SupportServerToClientEvents,
} from "@/shared/contracts/support";

let socket: Socket<
  SupportServerToClientEvents,
  SupportClientToServerEvents
> | null = null;

export function getSupportSocket() {
  socket ??= io("/support", {
    path: "/socket.io",
    transports: ["websocket"],
    upgrade: false,
    autoConnect: false,
    withCredentials: true,
  });
  return socket;
}

export function disconnectSupportSocket() {
  socket?.disconnect();
  socket = null;
}
