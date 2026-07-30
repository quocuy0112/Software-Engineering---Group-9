"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export function useReplayableStatus(initial = "") {
  const [status, setStatus] = useState(initial);
  const latestStatus = useRef(status);

  useEffect(() => {
    latestStatus.current = status;
  }, [status]);

  const setReplayableStatus = useCallback((nextStatus: string) => {
    if (nextStatus === latestStatus.current) {
      setStatus("");
      Promise.resolve().then(() => setStatus(nextStatus));
      return;
    }

    setStatus(nextStatus);
  }, []);

  return { status, setStatus: setReplayableStatus };
}
