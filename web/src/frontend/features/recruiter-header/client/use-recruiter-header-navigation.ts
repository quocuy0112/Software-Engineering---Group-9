"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NavigationAdapter = {
  openSameOrigin: (href: string) => void;
  openExternal: (href: string) => Window | null;
};

const defaultAdapter: NavigationAdapter = {
  openSameOrigin: (href) => window.location.assign(href),
  openExternal: (href) => window.open(href, "_blank", "noopener,noreferrer"),
};

export function useRecruiterHeaderNavigation(
  adapter: NavigationAdapter = defaultAdapter,
) {
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const release = useCallback(() => {
    lockRef.current = false;
    setBusy(false);
  }, []);

  useEffect(() => {
    const recover = () => release();
    const onVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };
    window.addEventListener("focus", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [release]);

  const open = useCallback(
    (href: string | null) => {
      if (!href || lockRef.current) return false;
      lockRef.current = true;
      setBusy(true);
      try {
        const destination = new URL(href, window.location.origin);
        if (destination.origin === window.location.origin) {
          const before = window.location.pathname;
          adapter.openSameOrigin(
            destination.pathname + destination.search + destination.hash,
          );
          if (window.location.pathname === before) {
            window.setTimeout(release, 0);
          }
          return true;
        }
        const opened = adapter.openExternal(destination.toString());
        if (!opened) release();
        return Boolean(opened);
      } catch {
        release();
        return false;
      }
    },
    [adapter, release],
  );

  return { busy, open, release };
}
