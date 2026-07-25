"use client";
import { useEffect, useRef, useState } from "react";

export function useReplayableStatus(initial = "") {
  const [status, setStatus] = useState(initial);
  const latestStatus = useRef(status);

  useEffect(() => {
    latestStatus.current = status;
  }, [status]);

  function setReplayableStatus(nextStatus: string) {
    if (nextStatus === latestStatus.current) {
      setStatus("");
      Promise.resolve().then(() => setStatus(nextStatus));
      return;
    }

    setStatus(nextStatus);
  }

  return { status, setStatus: setReplayableStatus };
}
