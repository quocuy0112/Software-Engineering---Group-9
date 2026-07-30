"use client";
import { useCallback, useRef, useState } from "react";
export function useSafeSubmit<T extends unknown[]>(
  operation: (...args: T) => Promise<void>,
) {
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const submit = useCallback(
    async (...args: T) => {
      if (active.current) return false;
      active.current = true;
      setBusy(true);
      try {
        await operation(...args);
        return true;
      } finally {
        active.current = false;
        setBusy(false);
      }
    },
    [operation],
  );
  return { submit, busy };
}
