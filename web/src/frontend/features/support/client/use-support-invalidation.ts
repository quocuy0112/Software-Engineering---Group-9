"use client";

import { useEffect, useState } from "react";
import type { SupportInvalidation } from "@/shared/contracts/support";
import { getSupportSocket } from "./support-socket";

export function useSupportInvalidation(
  onChanged: (event: SupportInvalidation) => void,
) {
  const [connection, setConnection] = useState<
    "CONNECTING" | "CONNECTED" | "OFFLINE"
  >("CONNECTING");
  useEffect(() => {
    const socket = getSupportSocket();
    const connected = () => setConnection("CONNECTED");
    const disconnected = () => setConnection("CONNECTING");
    const failed = () => setConnection("OFFLINE");
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", failed);
    socket.on("support:case:changed", onChanged);
    socket.connect();
    return () => {
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", failed);
      socket.off("support:case:changed", onChanged);
    };
  }, [onChanged]);
  return connection;
}
