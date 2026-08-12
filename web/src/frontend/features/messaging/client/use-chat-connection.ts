"use client";

import { useEffect, useState } from "react";
import { disconnectChatSocket, getChatSocket } from "./chat-socket";

export function useChatConnection(input: {
  onAuthoritativeRefetch: () => void | Promise<void>;
  onProtectedCachePurge: (conversationId?: string) => void;
}) {
  const [state, setState] = useState<"CONNECTING" | "CONNECTED" | "RECONNECTING" | "OFFLINE">(
    "CONNECTING",
  );
  useEffect(() => {
    const socket = getChatSocket();
    const connected = () => {
      setState("CONNECTED");
      input.onProtectedCachePurge();
      void input.onAuthoritativeRefetch();
    };
    const disconnected = () => setState("RECONNECTING");
    const failed = () => setState("OFFLINE");
    const revoked = ({ conversationId }: { conversationId: string }) => {
      input.onProtectedCachePurge(conversationId);
      void input.onAuthoritativeRefetch();
    };
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", failed);
    socket.on("conversation:access_revoked", revoked);
    socket.connect();
    return () => {
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", failed);
      socket.off("conversation:access_revoked", revoked);
    };
  }, [input]);
  return state;
}

export function closeMessagingConnectionOnLogout() {
  disconnectChatSocket();
}
