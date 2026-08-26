"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileUp,
  Info,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  UserPen,
} from "lucide-react";

import type {
  CvConsentGrantRequest,
  CvConsentNotice,
} from "@/shared/contracts/cv-import/consent-retention";
import type { CvImportResource } from "@/shared/contracts/cv-import/upload";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy } from "../i18n/cv-import-copy";
import { CvRecoveryActionError } from "./cv-failure-recovery";
import styles from "./cv-consent-required-recovery.module.css";

type ConsentRequiredResource = Readonly<{
  uploadId: string;
  availableActions: CvImportResource["availableActions"];
  failure: CvImportResource["failure"];
}>;

type ActiveAction = "grant" | "delete";

export function CvConsentRequiredRecovery({
  resource,
  notice,
  canGrant,
  onGrant,
  onDelete,
}: {
  resource: ConsentRequiredResource;
  notice: CvConsentNotice;
  canGrant: boolean;
  onGrant: (request: CvConsentGrantRequest) => Promise<void>;
  onDelete: () => Promise<boolean | void> | boolean | void;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).consentRequiredRecovery;
  const heading = useRef<HTMLHeadingElement>(null);
  const activeAction = useRef<ActiveAction | null>(null);
  const [busy, setBusy] = useState<ActiveAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canDelete = Boolean(
    resource.availableActions.includes("DELETE") ||
      resource.failure?.suggestedActions.includes("DELETE"),
  );
  const canEnterManually = Boolean(
    resource.availableActions.includes("MANUAL_PROFILE") ||
      resource.failure?.suggestedActions.includes("MANUAL_PROFILE"),
  );

  const grant = async () => {
    if (activeAction.current || !canGrant) return;
    activeAction.current = "grant";
    setBusy("grant");
    setMessage(null);
    try {
      await onGrant({
        accepted: true,
        consentChallenge: notice.consentChallenge,
      });
      setMessage(copy.granted);
    } catch (error) {
      const expired =
        error instanceof Error && error.message === "CV_SESSION_EXPIRED";
      setMessage(expired ? copy.sessionExpired : copy.grantError);
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  const remove = async () => {
    if (activeAction.current || !canDelete) return;
    activeAction.current = "delete";
    setBusy("delete");
    setMessage(null);
    try {
      const deleted = await onDelete();
      setMessage(deleted === false ? copy.deleteCancelled : copy.deleteRequested);
    } catch (error) {
      setMessage(
        error instanceof CvRecoveryActionError
          ? error.message
          : copy.deleteError,
      );
      heading.current?.focus();
    } finally {
      activeAction.current = null;
      setBusy(null);
    }
  };

  return (
    <section
      className={styles.root}
      data-testid="cv-consent-required-recovery"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      aria-labelledby="cv-consent-required-heading"
    >
      <header className={styles.header} role="alert">
        <span className={styles.alertIcon} aria-hidden="true">
          <ShieldAlert />
        </span>
        <div className={styles.headerCopy}>
          <div className={styles.titleRow}>
            <h2 id="cv-consent-required-heading" ref={heading} tabIndex={-1}>
              {copy.heading}
            </h2>
            <span className={styles.consentBadge}>{copy.badge}</span>
          </div>
          <p>{copy.description}</p>
        </div>
      </header>

      <details className={styles.technicalDetails}>
        <summary>
          <span>
            <Terminal aria-hidden="true" />
            {copy.technicalDetails}
          </span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.technicalBody}>
          <p>
            {copy.safeCode}: <code>{resource.failure?.code}</code>
          </p>
          <p>{copy.reason}</p>
        </div>
      </details>

      <div className={styles.recoveryArea}>
        <p className={styles.eyebrow}>{copy.chooseAction}</p>
        <div className={styles.actionGrid}>
          <article className={`${styles.actionCard} ${styles.primaryAction}`}>
            <div>
              <div className={styles.actionTopline}>
                <span className={styles.actionIcon} aria-hidden="true">
                  <Sparkles />
                </span>
                <span className={styles.fastestBadge}>{copy.fastest}</span>
              </div>
              <h3>{copy.grantTitle}</h3>
              <p>{copy.grantDescription}</p>
            </div>
            <button
              type="button"
              disabled={!canGrant || Boolean(busy)}
              aria-busy={busy === "grant"}
              onClick={() => void grant()}
            >
              <span>{busy === "grant" ? copy.granting : copy.grantAction}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </article>

          <article className={styles.actionCard}>
            <div>
              <span className={styles.actionIcon} aria-hidden="true">
                <FileUp />
              </span>
              <h3>{copy.replacementTitle}</h3>
              <p>{copy.replacementDescription}</p>
            </div>
            <Link href="/profile/cv-imports">
              <span>{copy.replacementAction}</span>
              <ChevronRight aria-hidden="true" />
            </Link>
          </article>

          {canEnterManually ? (
            <article className={styles.actionCard}>
              <div>
                <span className={styles.actionIcon} aria-hidden="true">
                  <UserPen />
                </span>
                <h3>{copy.manualTitle}</h3>
                <p>{copy.manualDescription}</p>
              </div>
              <Link href="/profile">
                <span>{copy.manualAction}</span>
                <ChevronRight aria-hidden="true" />
              </Link>
            </article>
          ) : null}
        </div>
      </div>

      <footer className={styles.footer}>
        <p>
          <Info aria-hidden="true" />
          <span>{copy.guidance}</span>
        </p>
        {canDelete ? (
          <button
            className={styles.deleteButton}
            type="button"
            disabled={Boolean(busy)}
            aria-busy={busy === "delete"}
            onClick={() => void remove()}
          >
            <Trash2 aria-hidden="true" />
            {busy === "delete" ? copy.deleting : copy.delete}
          </button>
        ) : null}
      </footer>

      {message ? (
        <p className={styles.status} role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </section>
  );
}
