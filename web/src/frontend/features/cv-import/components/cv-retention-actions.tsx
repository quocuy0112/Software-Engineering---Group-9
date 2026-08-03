"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cvDeletionOutcomeSchema,
  type CvDeletionOutcome,
} from "@/shared/contracts/cv-import/consent-retention";
import styles from "./cv-retention-actions.module.css";

export type CvRetentionActionResource = Readonly<{
  uploadId: string;
  status: string;
  expiresAt: string | null;
  contentInaccessibleAt: string | null;
  deleteAfter: string | null;
  deletedAt: string | null;
}>;

function shortDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().replace("T", " ");
}

function outcomeMessage(resource: CvRetentionActionResource): string {
  if (resource.status === "CANCELLED") {
    return `Deletion accepted. Content access is disabled immediately; protected cleanup is pending and must finish by ${shortDate(resource.deleteAfter) ?? "the 24-hour deadline"}.`;
  }
  if (resource.status === "DELETED") {
    return "Deletion complete. Temporary import content has been removed; minimized non-content evidence may be retained.";
  }
  if (resource.status === "EXPIRED") {
    return `This import expired. Content and retry access are disabled; deadline-driven cleanup continues through ${shortDate(resource.deleteAfter) ?? "its retention deadline"}.`;
  }
  return "Temporary CV content remains protected and subject to the deadlines shown below.";
}

export function CvRetentionActions({
  resource,
  canDelete,
  onDelete,
}: {
  resource: CvRetentionActionResource;
  canDelete: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const active = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localOutcomeState, setLocalOutcomeState] = useState<{
    uploadId: string;
    outcome: CvDeletionOutcome;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    uploadId: string;
    message: string;
  } | null>(null);
  const localOutcome =
    localOutcomeState?.uploadId === resource.uploadId
      ? localOutcomeState.outcome
      : null;
  const error =
    errorState?.uploadId === resource.uploadId ? errorState.message : null;

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    window.setTimeout(() => trigger.current?.focus(), 0);
  }, [busy]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => confirm.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const controls = Array.from(
        dialog.current.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", keydown);
    };
  }, [busy, close, open]);

  const remove = async () => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setErrorState(null);
    try {
      const outcome = await onDelete();
      if (outcome !== undefined) {
        setLocalOutcomeState({
          uploadId: resource.uploadId,
          outcome: cvDeletionOutcomeSchema.parse(outcome),
        });
      }
      setOpen(false);
    } catch {
      setErrorState({
        uploadId: resource.uploadId,
        message:
          "Deletion could not be accepted. This import remains unchanged.",
      });
      setOpen(false);
      window.setTimeout(() => trigger.current?.focus(), 0);
    } finally {
      active.current = false;
      setBusy(false);
    }
  };

  const current: CvRetentionActionResource = localOutcome
    ? {
        uploadId: localOutcome.uploadId,
        status: localOutcome.status,
        expiresAt: resource.expiresAt,
        contentInaccessibleAt: localOutcome.contentInaccessibleAt,
        deleteAfter: localOutcome.deleteAfter,
        deletedAt: localOutcome.deletedAt,
      }
    : resource;
  const expiry = shortDate(current.expiresAt);
  const cleanup = shortDate(current.deleteAfter);

  return (
    <section
      className={styles.root}
      data-testid="cv-retention-actions"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      aria-labelledby="cv-retention-heading"
    >
      <h2 id="cv-retention-heading">Retention and deletion</h2>
      <dl className={styles.deadlines}>
        {expiry ? (
          <div>
            <dt>Import expiry</dt>
            <dd>{expiry}</dd>
          </div>
        ) : null}
        {cleanup ? (
          <div>
            <dt>Content cleanup deadline</dt>
            <dd>{cleanup}</dd>
          </div>
        ) : null}
      </dl>
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {error ?? outcomeMessage(current)}
      </p>
      <div className={styles.actions}>
        {canDelete &&
        !["CANCELLED", "DELETED", "EXPIRED"].includes(current.status) ? (
          <button ref={trigger} type="button" onClick={() => setOpen(true)}>
            Cancel and delete this CV import
          </button>
        ) : null}
        <Link href="/profile">Open Candidate Profile</Link>
      </div>

      {open ? (
        <div
          className={styles.backdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            ref={dialog}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv-retention-dialog-heading"
            aria-describedby="cv-retention-dialog-description"
            aria-busy={busy}
          >
            <h2 id="cv-retention-dialog-heading">
              Permanently delete temporary CV data?
            </h2>
            <p id="cv-retention-dialog-description">
              Access ends immediately. SmartHire cancels queued processing and
              removes source, extracted, draft, and provenance content within 24
              hours. Your Candidate Profile remains available and is not changed
              by this deletion.
            </p>
            <div className={styles.dialogActions}>
              <button
                ref={confirm}
                type="button"
                disabled={busy}
                aria-busy={busy}
                onClick={() => void remove()}
              >
                Confirm cancel and delete
              </button>
              <button type="button" disabled={busy} onClick={close}>
                Keep import
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
