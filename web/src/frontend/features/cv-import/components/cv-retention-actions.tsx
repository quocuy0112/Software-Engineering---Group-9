"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cvDeletionOutcomeSchema,
  type CvDeletionOutcome,
} from "@/shared/contracts/cv-import/consent-retention";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import {
  cvCopy,
  cvFormatDate,
  cvRetentionDaysLeft,
  type CvLocale,
} from "../i18n/cv-import-copy";
import styles from "./cv-retention-actions.module.css";

export type CvRetentionActionResource = Readonly<{
  uploadId: string;
  status: string;
  expiresAt: string | null;
  contentInaccessibleAt: string | null;
  deleteAfter: string | null;
  deletedAt: string | null;
}>;

function shortDate(locale: CvLocale, value: string | null): string | null {
  if (!value) return null;
  return cvFormatDate(locale, value, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function outcomeMessage(
  locale: CvLocale,
  resource: CvRetentionActionResource,
): string {
  const copy = cvCopy(locale).retention;
  if (resource.status === "CANCELLED") {
    return `${copy.cancelled} ${shortDate(locale, resource.deleteAfter) ?? (locale === "vi" ? "hạn 24 giờ" : "the 24-hour deadline")}.`;
  }
  if (resource.status === "DELETED") {
    return copy.deleted;
  }
  if (resource.status === "EXPIRED") {
    return `${copy.expired} ${shortDate(locale, resource.deleteAfter) ?? (locale === "vi" ? "hạn lưu giữ" : "its retention deadline")}.`;
  }
  return copy.temporary;
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / 86_400_000));
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
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).retention;
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
          locale === "vi"
            ? "Không thể chấp nhận yêu cầu xóa. Lần nhập vẫn được giữ nguyên."
            : "Deletion could not be accepted. This import remains unchanged.",
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
  const expiry = shortDate(locale, current.expiresAt);
  const cleanup = shortDate(locale, current.deleteAfter);
  const daysLeft = daysUntil(current.expiresAt);

  return (
    <section
      className={styles.root}
      data-testid="cv-retention-actions"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      aria-labelledby="cv-retention-heading"
    >
      <h2 id="cv-retention-heading">{copy.heading}</h2>
      <div className={styles.card}>
        <dl className={styles.deadlines}>
          {expiry ? (
            <div className={styles.expiryBlock}>
              <dt>
                <span className={styles.expiryIcon} aria-hidden="true">
                  ⌛
                </span>
                {copy.expiry}
              </dt>
              <dd>
                <span>{expiry}</span>
                {daysLeft !== null ? (
                  <span className={styles.daysLeft}>
                    {cvRetentionDaysLeft(locale, daysLeft)}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {cleanup ? (
            <div className={styles.cleanup}>
              <dt>{copy.cleanup}</dt>
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
          {error ?? outcomeMessage(locale, current)}
        </p>
        <div className={styles.actions}>
          {canDelete &&
          !["CANCELLED", "DELETED", "EXPIRED"].includes(current.status) ? (
            <button ref={trigger} type="button" onClick={() => setOpen(true)}>
              {copy.cancelDelete}
            </button>
          ) : null}
          <Link href="/profile">{cvCopy(locale).common.openProfile}</Link>
        </div>
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
            <h2 id="cv-retention-dialog-heading">{copy.deleteDialog}</h2>
            <p id="cv-retention-dialog-description">{copy.deleteDescription}</p>
            <div className={styles.dialogActions}>
              <button
                ref={confirm}
                type="button"
                disabled={busy}
                aria-busy={busy}
                onClick={() => void remove()}
              >
                {copy.confirmDelete}
              </button>
              <button type="button" disabled={busy} onClick={close}>
                {copy.keep}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
