"use client";

import { useEffect, useState } from "react";
import type { ConnectionInvalidation } from "@/shared/contracts/connections";
import { getConnectionSocket } from "./connection-socket";

export function useConnectionInvalidation(
  onChanged: (event: ConnectionInvalidation) => void,
) {
  const [state, setState] = useState<"CONNECTING" | "CONNECTED" | "OFFLINE">(
    "CONNECTING",
  );
  useEffect(() => {
    const socket = getConnectionSocket();
    const connected = () => setState("CONNECTED");
    const disconnected = () => setState("CONNECTING");
    const failed = () => setState("OFFLINE");
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", failed);
    socket.on("connection:changed", onChanged);
    socket.connect();
    return () => {
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", failed);
      socket.off("connection:changed", onChanged);
    };
  }, [onChanged]);
  return state;
}
