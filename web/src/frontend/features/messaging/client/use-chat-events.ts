"use client";

import { useEffect } from "react";
import type { MessagingMessage, ReadBoundary } from "@/shared/contracts/messaging/messages";
import { getChatSocket } from "./chat-socket";

export function useChatEvents(input: {
  onMessage: (message: MessagingMessage) => void;
  onRead: (boundary: ReadBoundary) => void;
  onAccessRevoked: (conversationId: string) => void;
  onPresence?: (event: { userId: string; presence: "ONLINE" | "OFFLINE" }) => void;
}) {
  useEffect(() => {
    const socket = getChatSocket();
    const onMessage = (event: { message: MessagingMessage }) => input.onMessage(event.message);
    const onRead = (event: ReadBoundary) => input.onRead(event);
    const onRevoked = (event: { conversationId: string }) =>
      input.onAccessRevoked(event.conversationId);
    const onPresence = (event: { userId: string; presence: "ONLINE" | "OFFLINE" }) =>
      input.onPresence?.(event);
    socket.on("message:new", onMessage);
    socket.on("message:read", onRead);
    socket.on("conversation:access_revoked", onRevoked);
    socket.on("presence:changed", onPresence);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("message:read", onRead);
      socket.off("conversation:access_revoked", onRevoked);
      socket.off("presence:changed", onPresence);
    };
  }, [input]);
}
