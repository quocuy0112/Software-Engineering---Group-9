"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseRecruiterHeaderStatus,
  type RecruiterHeaderStatus,
} from "@/shared/contracts/recruiter-header-status";

const REFRESH_INTERVAL_MS = 30_000;

export function useRecruiterHeaderStatus(
  initialStatus?: RecruiterHeaderStatus | null,
) {
  const [status, setStatus] = useState<RecruiterHeaderStatus | null>(
    initialStatus ?? null,
  );
  const [checking, setChecking] = useState(initialStatus == null);
  const [unavailable, setUnavailable] = useState(initialStatus == null);
  const requestRef = useRef<AbortController | null>(null);
  const sequenceRef = useRef(0);

  const refresh = useCallback(async () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const sequence = ++sequenceRef.current;
    setChecking(true);
    try {
      const response = await fetch("/api/recruiter/header-status", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("status-unavailable");
      const parsed = parseRecruiterHeaderStatus(await response.json());
      if (sequence !== sequenceRef.current || controller.signal.aborted) return;
      setStatus(parsed);
      setUnavailable(false);
    } catch {
      if (controller.signal.aborted || sequence !== sequenceRef.current) return;
      setStatus(null);
      setUnavailable(true);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onFocus = () => void refresh();
    const interval = window.setInterval(
      () => void refresh(),
      REFRESH_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      sequenceRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  return { status, checking, unavailable, refresh };
}
