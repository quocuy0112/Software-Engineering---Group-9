"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CvUploadStatus } from "@/shared/contracts/cv-import/common";
import {
  cvConsentOutcomeSchema,
  cvDeletionOutcomeSchema,
  type CvConsentGrantRequest,
  type CvConsentNotice,
  type CvDeletionOutcome,
} from "@/shared/contracts/cv-import/consent-retention";
import { cvRetryAcceptedSchema } from "@/shared/contracts/cv-import/retry";
import {
  cvImportStatusResponseSchema,
  cvImportTombstoneSchema,
  cvStatusPollingAfterMs,
  type CvImportResource,
} from "@/shared/contracts/cv-import/upload";
import {
  CvFailureRecovery,
  CvRecoveryActionError,
} from "./cv-failure-recovery";
import { CvProcessingConsent } from "./cv-processing-consent";
import { CvRetentionActions } from "./cv-retention-actions";
import styles from "./cv-import-status.module.css";

type StatusResource = Readonly<{
  uploadId: string;
  status: CvUploadStatus;
  stage?: string;
  availableActions?: readonly string[];
  pollingAfterMs?: number | null;
  scanRetriesRemaining?: number;
  parseRetriesRemaining?: number;
  failure?: CvImportResource["failure"];
  consent?: CvConsentNotice | null;
  expiresAt?: string | null;
  contentInaccessibleAt?: string | null;
  deleteAfter?: string | null;
  deletedAt?: string | null;
}>;

function newRetryKey() {
  return `cv-retry-${crypto.randomUUID()}`;
}

function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function tombstonePollingAfterMs(resource: StatusResource): number | null {
  if (resource.status !== "CANCELLED" || resource.deletedAt) return null;
  const deadline = resource.deleteAfter
    ? new Date(resource.deleteAfter).getTime()
    : Number.NaN;
  return !Number.isNaN(deadline) && Date.now() < deadline ? 2_000 : null;
}

export function CvImportStatus({
  resource,
  loadStatus,
  csrfProof,
}: {
  resource: StatusResource;
  loadStatus?: () => Promise<StatusResource>;
  csrfProof?: string;
}) {
  const [current, setCurrent] = useState(resource);
  const [pollError, setPollError] = useState<string | null>(null);
  const retryKey = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    if (loadStatus) {
      const next = await loadStatus();
      if (mounted.current) {
        setCurrent(next);
        setPollError(null);
      }
      return next;
    }
    const response = await fetch(
      `/api/account/cv-imports/${current.uploadId}`,
      {
        cache: "no-store",
        credentials: "same-origin",
      },
    );
    if (!response.ok) throw new Error("CV_STATUS_REFRESH_FAILED");
    const parsed = cvImportStatusResponseSchema.parse(await response.json());
    const next: StatusResource = {
      ...parsed,
      pollingAfterMs:
        parsed.status === "CANCELLED"
          ? tombstonePollingAfterMs(parsed)
          : "stage" in parsed
            ? cvStatusPollingAfterMs(parsed.status)
            : null,
    };
    if (mounted.current) {
      setCurrent(next);
      setPollError(null);
    }
    return next;
  }, [current.uploadId, loadStatus]);

  useEffect(() => {
    if (!current.pollingAfterMs) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const delay = document.hidden
        ? Math.max(current.pollingAfterMs ?? 0, 10_000)
        : (current.pollingAfterMs ?? 0);
      timer = setTimeout(() => {
        void refreshStatus()
          .catch(() => {
            if (!active) return;
            setPollError(
              "Status could not be refreshed. SmartHire will keep trying.",
            );
            schedule();
          })
          .then(() => undefined);
      }, delay);
    };
    schedule();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [current.pollingAfterMs, refreshStatus]);

  const requestRetry = useCallback(async () => {
    if (!csrfProof)
      throw new CvRecoveryActionError(
        "Retry could not be queued. Refresh this page and try again.",
      );
    retryKey.current ??= newRetryKey();
    const response = await fetch(
      `/api/account/cv-imports/${current.uploadId}/retries`,
      {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "idempotency-key": retryKey.current,
          "x-csrf-token": csrfProof,
        },
        body: "{}",
      },
    );
    if (!response.ok) {
      const wait = retryAfterSeconds(response);
      throw new CvRecoveryActionError(
        wait
          ? "Retry is temporarily unavailable. The countdown shows when to try again."
          : "Retry could not be queued. Your failed import is unchanged.",
        wait,
      );
    }
    const outcome = cvRetryAcceptedSchema.parse(await response.json());
    if (outcome.uploadId !== current.uploadId)
      throw new CvRecoveryActionError(
        "Retry could not be verified. Your failed import is unchanged.",
      );
    await refreshStatus();
    retryKey.current = null;
  }, [csrfProof, current.uploadId, refreshStatus]);

  const deleteImport = useCallback(
    async (confirmed = false): Promise<CvDeletionOutcome | false> => {
      if (!csrfProof)
        throw new CvRecoveryActionError(
          "The import could not be deleted. Refresh this page and try again.",
        );
      if (
        !confirmed &&
        !window.confirm(
          "Delete this CV import? Access ends immediately, and protected physical cleanup continues in the background.",
        )
      )
        return false;
      const response = await fetch(
        `/api/account/cv-imports/${current.uploadId}`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "x-csrf-token": csrfProof },
        },
      );
      if (!response.ok)
        throw new CvRecoveryActionError(
          "The import could not be deleted. It remains available in your history.",
        );
      const outcome = cvDeletionOutcomeSchema.parse(await response.json());
      const tombstone = cvImportTombstoneSchema.parse({
        uploadId: outcome.uploadId,
        status: outcome.status,
        contentInaccessibleAt: outcome.contentInaccessibleAt,
        deleteAfter: outcome.deleteAfter,
        deletedAt: outcome.deletedAt,
      });
      if (mounted.current) {
        setCurrent({
          ...tombstone,
          pollingAfterMs: tombstonePollingAfterMs(tombstone),
        });
        setPollError(null);
      }
      retryKey.current = null;
      return outcome;
    },
    [csrfProof, current.uploadId],
  );

  const grantConsent = useCallback(
    async (request: CvConsentGrantRequest) => {
      if (!csrfProof) throw new Error("CV_CONSENT_UNAVAILABLE");
      const response = await fetch(
        `/api/account/cv-imports/${current.uploadId}/consent`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify(request),
        },
      );
      if (!response.ok) throw new Error("CV_CONSENT_GRANT_FAILED");
      const outcome = cvConsentOutcomeSchema.parse(await response.json());
      if (outcome.uploadId !== current.uploadId)
        throw new Error("CV_CONSENT_GRANT_FAILED");
      await refreshStatus();
    },
    [csrfProof, current.uploadId, refreshStatus],
  );

  const revokeConsent = useCallback(async () => {
    if (!csrfProof) throw new Error("CV_CONSENT_UNAVAILABLE");
    const response = await fetch(
      `/api/account/cv-imports/${current.uploadId}/consent`,
      {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfProof },
      },
    );
    if (response.status !== 204) throw new Error("CV_CONSENT_REVOKE_FAILED");
    await refreshStatus();
  }, [csrfProof, current.uploadId, refreshStatus]);

  const label = current.status.replaceAll("_", " ").toLowerCase();
  const availableActions = current.availableActions ?? [];
  const hasFailureRecovery = Boolean(
    current.failure &&
    typeof current.scanRetriesRemaining === "number" &&
    typeof current.parseRetriesRemaining === "number",
  );
  return (
    <section className={styles.root} aria-labelledby="cv-status-heading">
      <h2 id="cv-status-heading">CV processing status</h2>
      <p
        className={styles.state}
        role={!hasFailureRecovery && current.stage ? "status" : undefined}
        aria-live={!hasFailureRecovery && current.stage ? "polite" : undefined}
      >
        <strong>{label}</strong>
        {current.stage
          ? ` — stage ${current.stage.toLowerCase()}.`
          : ". Content is unavailable."}
      </p>
      {current.stage ? (
        <ol className={styles.timeline} aria-label="Processing timeline">
          {["UPLOAD", "SCAN", "EXTRACT", "PARSE", "REVIEW"].map((stage) => (
            <li
              key={stage}
              aria-current={current.stage === stage ? "step" : undefined}
            >
              {current.stage === stage ? "Current: " : ""}
              {stage.toLowerCase()}
            </li>
          ))}
        </ol>
      ) : null}
      {pollError ? (
        <p className={styles.pollError} role="alert">
          {pollError}
        </p>
      ) : null}
      {hasFailureRecovery ? (
        <CvFailureRecovery
          key={`${current.status}:${current.failure?.code}:${current.scanRetriesRemaining}:${current.parseRetriesRemaining}`}
          resource={{
            uploadId: current.uploadId,
            status: current.status,
            availableActions:
              availableActions as CvImportResource["availableActions"],
            scanRetriesRemaining: current.scanRetriesRemaining ?? 0,
            parseRetriesRemaining: current.parseRetriesRemaining ?? 0,
            failure: current.failure ?? null,
          }}
          retryAfterSeconds={null}
          onRetry={requestRetry}
          onDelete={async () => (await deleteImport()) !== false}
        />
      ) : (
        <div className={styles.actions}>
          {availableActions.includes("RETRY") ? (
            <button type="button">Retry</button>
          ) : null}
          {availableActions.includes("REVIEW") ? (
            <a href={`/profile/cv-imports/${current.uploadId}/review`}>
              Review draft
            </a>
          ) : null}
          {availableActions.includes("MANUAL_PROFILE") ? (
            <a href="/profile">Manual profile</a>
          ) : null}
        </div>
      )}
      {current.consent ? (
        <CvProcessingConsent
          notice={current.consent}
          canGrant={Boolean(
            csrfProof && availableActions.includes("GRANT_CONSENT"),
          )}
          canRevoke={Boolean(
            csrfProof && availableActions.includes("REVOKE_CONSENT"),
          )}
          onGrant={grantConsent}
          onRevoke={revokeConsent}
        />
      ) : null}
      {current.expiresAt ||
      current.deleteAfter ||
      current.contentInaccessibleAt ||
      !current.stage ? (
        <CvRetentionActions
          resource={{
            uploadId: current.uploadId,
            status: current.status,
            expiresAt: current.expiresAt ?? null,
            contentInaccessibleAt: current.contentInaccessibleAt ?? null,
            deleteAfter: current.deleteAfter ?? null,
            deletedAt: current.deletedAt ?? null,
          }}
          canDelete={Boolean(
            csrfProof &&
            availableActions.includes("DELETE") &&
            !hasFailureRecovery,
          )}
          onDelete={async () => deleteImport(true)}
        />
      ) : null}
    </section>
  );
}
