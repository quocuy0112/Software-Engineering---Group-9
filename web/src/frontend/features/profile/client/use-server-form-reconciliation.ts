"use client";

import { useEffect, useRef } from "react";

/**
 * Reconcile a form only when its own server projection changes.
 *
 * Profile saves refetch the complete aggregate. Object identities therefore
 * change even when another section was saved; resetting on identity alone
 * would erase an in-progress edit in this section.
 */
export function useServerFormReconciliation<T>(
  values: T,
  reset: (values: T) => void,
) {
  const snapshot = JSON.stringify(values);
  const previousSnapshot = useRef(snapshot);

  useEffect(() => {
    if (previousSnapshot.current === snapshot) return;
    previousSnapshot.current = snapshot;
    reset(values);
  }, [reset, snapshot, values]);
}
