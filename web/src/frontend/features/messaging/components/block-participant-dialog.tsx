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
    <div className="messaging-safety-control">
      <button
        ref={trigger}
        className="messaging-icon-button"
        type="button"
        aria-label={`${blocked ? "Unblock" : "Block"} ${targetName}`}
        title={`${blocked ? "Unblock" : "Block"} ${targetName}`}
        onClick={() => setOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m6 6 12 12" />
        </svg>
        <span className="sr-only">{blocked ? "Unblock" : "Block"} {targetName}</span>
      </button>
      {open ? (
        <div className="messaging-modal-layer">
          <section
            className="messaging-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${blocked ? "Unblock" : "Block"} ${targetName}`}
          >
            <div className="messaging-modal-icon" data-tone={blocked ? "info" : "danger"} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="m6 6 12 12" />
              </svg>
            </div>
            <h3>{blocked ? "Resume messaging?" : "Stop communication?"}</h3>
            <p>
              Existing message history is retained. Blocking immediately stops new messages and presence sharing.
            </p>
            {error ? <p className="messaging-inline-alert" role="alert">{error}</p> : null}
            <div className="messaging-modal-actions">
              <button className={blocked ? "messaging-primary-button" : "messaging-danger-button"} type="button" disabled={busy} onClick={() => void confirm()}>
                {busy ? "Saving..." : `Confirm ${blocked ? "unblock" : "block"}`}
              </button>
              <button className="messaging-secondary-button" type="button" disabled={busy} onClick={close}>
                Cancel
              </button>
              {onReport ? (
                <button className="messaging-text-button" type="button" onClick={onReport}>
                  Report this conversation
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
