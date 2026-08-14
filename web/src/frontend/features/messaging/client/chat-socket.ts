"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ChatClientToServerEvents,
  ChatServerToClientEvents,
} from "@/shared/contracts/messaging/socket-events";
import { REALTIME_SOCKET_PATH } from "@/shared/contracts/realtime/socket-transport";

export type ChatClientSocket = Socket<
  ChatServerToClientEvents,
  ChatClientToServerEvents
>;

let singleton: ChatClientSocket | null = null;

export function getChatSocket(): ChatClientSocket {
  if (typeof window === "undefined") {
    throw new Error("CHAT_SOCKET_BROWSER_ONLY");
  }
  singleton ??= io("/chat", {
    path: REALTIME_SOCKET_PATH,
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
    ackTimeout: 5_000,
    retries: 2,
  });
  return singleton;
}

export function disconnectChatSocket() {
  singleton?.removeAllListeners();
  singleton?.disconnect();
  singleton = null;
}
