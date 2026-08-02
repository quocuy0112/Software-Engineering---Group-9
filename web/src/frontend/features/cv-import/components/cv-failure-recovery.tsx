"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CvImportResource } from "@/shared/contracts/cv-import/upload";
import styles from "./cv-failure-recovery.module.css";

export type CvFailureRecoveryResource = Readonly<{
  uploadId: string;
  status: CvImportResource["status"];
  availableActions: CvImportResource["availableActions"];
  scanRetriesRemaining: number;
  parseRetriesRemaining: number;
  failure: CvImportResource["failure"];
}>;

export class CvRecoveryActionError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "CvRecoveryActionError";
  }
}

type ActiveAction = "retry" | "delete";

function retryDetails(resource: CvFailureRecoveryResource) {
  if (resource.status === "SCAN_FAILED")
    return { count: resource.scanRetriesRemaining, label: "scan" } as const;
  if (resource.status === "PARSE_FAILED")
    return {
      count: resource.parseRetriesRemaining,
      label: "parsing",
    } as const;
  return null;
}

function retryCountMessage(details: ReturnType<typeof retryDetails>) {
  if (!details) return null;
  if (details.count === 0) return `No ${details.label} retries remaining.`;
  return `${details.count} ${details.label} ${details.count === 1 ? "retry" : "retries"} remaining.`;
}

export function CvFailureRecovery({
  resource,
  retryAfterSeconds,
  onRetry,
  onDelete,
}: {
  resource: CvFailureRecoveryResource;
  retryAfterSeconds: number | null;
  onRetry: () => Promise<void>;
  onDelete: () => Promise<boolean | void> | boolean | void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const activeAction = useRef<ActiveAction | null>(null);
  const [busy, setBusy] = useState<ActiveAction | null>(null);
  const [countdown, setCountdown] = useState(() =>
    Math.max(0, retryAfterSeconds ?? 0),
  );
  const [countdownRun, setCountdownRun] = useState(() =>
    retryAfterSeconds ? 1 : 0,
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const details = retryDetails(resource);
  const canRetry = Boolean(
    resource.failure?.retryable &&
    resource.failure.suggestedActions.includes("RETRY") &&
    resource.availableActions.includes("RETRY") &&
    details &&
    details.count > 0,
  );

  useEffect(() => {
    const focused = document.activeElement;
    if (!focused || focused === document.body) heading.current?.focus();
  }, [resource.failure?.code]);

  useEffect(() => {
    if (countdownRun === 0) return;
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        const next = Math.max(0, current - 1);
        if (next === 0) window.clearInterval(timer);
        return next;
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [countdownRun]);

  const retry = async () => {
    if (activeAction.current || !canRetry || countdown > 0) return;
    activeAction.current = "retry";
    setBusy("retry");
    setActionMessage(null);
    try {
      await onRetry();
      setActionMessage("Retry queued.");
    } catch (error) {
      if (error instanceof CvRecoveryActionError) {
        if (error.retryAfterSeconds) {
          setCountdown(Math.max(1, error.retryAfterSeconds));
          setCountdownRun((current) => current + 1);
        }
        setActionMessage(error.message);
      } else {
        setActionMessage(
          "Retry could not be queued. Your failed import is unchanged.",
        );
      }
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  const remove = async () => {
    if (activeAction.current) return;
    activeAction.current = "delete";
    setBusy("delete");
    setActionMessage(null);
    try {
      const deleted = await onDelete();
      setActionMessage(
        deleted === false
          ? "Import deletion cancelled."
          : "Import deletion requested.",
      );
    } catch (error) {
      setActionMessage(
        error instanceof CvRecoveryActionError
          ? error.message
          : "The import could not be deleted. It remains available in your history.",
      );
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  const statusMessage = busy
    ? busy === "retry"
      ? "Requesting retry…"
      : "Requesting import deletion…"
    : (actionMessage ??
      (canRetry
        ? countdown > 0
          ? `Retry available in ${countdown} ${countdown === 1 ? "second" : "seconds"}.`
          : "Retry is available."
        : "Choose a recovery action below."));

  return (
    <section
      className={styles.root}
      data-testid="cv-failure-recovery"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      aria-labelledby="cv-failure-heading"
    >
      <div
        className={styles.summary}
        role="alert"
        aria-labelledby="cv-failure-heading"
      >
        <h2 id="cv-failure-heading" ref={heading} tabIndex={-1}>
          CV processing could not finish
        </h2>
        <p>{resource.failure?.message}</p>
        <p className={styles.code}>
          Safe result code: <code>{resource.failure?.code}</code>
        </p>
      </div>

      {details ? (
        <p className={styles.counter}>{retryCountMessage(details)}</p>
      ) : null}
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage}
      </p>

      <div className={styles.actions} aria-label="CV failure recovery actions">
        {canRetry ? (
          <button
            type="button"
            disabled={Boolean(busy) || countdown > 0}
            aria-busy={busy === "retry"}
            onClick={() => void retry()}
          >
            Retry {details?.label}
          </button>
        ) : null}
        <Link href="/profile/cv-imports">Upload a replacement CV</Link>
        {resource.availableActions.includes("MANUAL_PROFILE") ||
        resource.failure?.suggestedActions.includes("MANUAL_PROFILE") ? (
          <Link href="/profile">Enter Candidate Profile manually</Link>
        ) : null}
        {resource.availableActions.includes("DELETE") ||
        resource.failure?.suggestedActions.includes("DELETE") ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            aria-busy={busy === "delete"}
            onClick={() => void remove()}
          >
            Delete import
          </button>
        ) : null}
      </div>
      <p className={styles.guidance}>
        You can recover without waiting for another person. Manual entry keeps
        this failed import in your history and does not create an empty draft.
      </p>
    </section>
  );
}
