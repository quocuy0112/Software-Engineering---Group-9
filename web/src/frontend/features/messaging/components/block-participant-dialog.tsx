"use client";

import { useRef, useState } from "react";

export function BlockParticipantDialog({
  csrfProof,
  targetUserId,
  targetName,
  blocked,
  onChanged,
  onReport,
}: {
  csrfProof: string;
  targetUserId: string;
  targetName: string;
  blocked: boolean;
  onChanged: (blocked: boolean) => void;
  onReport?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    queueMicrotask(() => trigger.current?.focus());
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/messaging/blocks/${encodeURIComponent(targetUserId)}`, {
        method: blocked ? "DELETE" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "x-csrf-proof": csrfProof,
          ...(blocked ? {} : { "idempotency-key": crypto.randomUUID() }),
        },
      });
      if (!response.ok) throw new Error("BLOCK_CHANGE_FAILED");
      const projection = (await response.json()) as { blocked: boolean };
      onChanged(projection.blocked);
      close();
    } catch {
      setError("The safety setting could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        {blocked ? "Unblock" : "Block"} {targetName}
      </button>
      {open ? (
        <section role="dialog" aria-modal="true" aria-label={`${blocked ? "Unblock" : "Block"} ${targetName}`}>
          <h3>{blocked ? "Resume messaging?" : "Stop communication?"}</h3>
          <p>
            Existing message history is retained. Blocking immediately stops new messages and presence sharing.
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <button type="button" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Saving..." : `Confirm ${blocked ? "unblock" : "block"}`}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          {onReport ? (
            <button type="button" onClick={onReport}>
              Report this conversation
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
