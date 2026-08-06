"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CvParserClass,
  CvUploadStatus,
} from "@/shared/contracts/cv-import/common";
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
  parserClass?: CvParserClass;
  status: CvUploadStatus;
  stage?: string;
  availableActions?: readonly string[];
  pollingAfterMs?: number | null;
  scanRetriesRemaining?: number;
  parseRetriesRemaining?: number;
  failure?: CvImportResource["failure"];
  ocr?: CvImportResource["ocr"];
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

type TimelineState = "complete" | "current" | "upcoming" | "error";

const stageLabels = {
  UPLOAD: "Upload",
  VALIDATE: "Validate",
  SCAN: "Virus scan",
  EXTRACT: "Extract text",
  OCR: "Recognize document images",
  CONSENT: "Consent",
  PARSE: "Parse",
  REVIEW: "Review",
} as const;

function visualStage(resource: StatusResource): keyof typeof stageLabels {
  if (resource.status === "VALIDATION_FAILED") return "VALIDATE";
  if (resource.status === "INFECTED" || resource.status === "SCAN_FAILED")
    return "SCAN";
  if (resource.status === "EXTRACTION_FAILED") return "EXTRACT";
  if (resource.status === "PARSE_FAILED") return "PARSE";
  if (resource.status === "REVIEW_READY" || resource.status === "CONFIRMED")
    return "REVIEW";
  const stage = resource.stage as keyof typeof stageLabels | undefined;
  return stage && stage in stageLabels ? stage : "UPLOAD";
}

function timelineState(input: {
  index: number;
  currentIndex: number;
  failed: boolean;
}): TimelineState {
  if (input.index < input.currentIndex) return "complete";
  if (input.index > input.currentIndex) return "upcoming";
  return input.failed ? "error" : "current";
}

function aiPresentation(resource: StatusResource): Readonly<{
  tone: "pending" | "processing" | "success" | "error" | "preparing";
  badge: string;
  title: string;
  message: string;
}> | null {
  if (resource.parserClass !== "EXTERNAL_OPENAI") return null;
  if (resource.status === "AWAITING_CONSENT")
    return {
      tone: "pending",
      badge: "Consent needed",
      title: "OpenAI is waiting for your permission",
      message:
        "No CV text has been sent to OpenAI. Review the consent notice below to continue.",
    };
  if (resource.status === "PARSE_QUEUED")
    return {
      tone: "pending",
      badge: "Queued",
      title: "OpenAI request is queued",
      message:
        "Consent is valid and the worker is preparing the request. This page refreshes automatically.",
    };
  if (resource.status === "PARSING")
    return {
      tone: "processing",
      badge: "API in progress",
      title: "OpenAI is extracting profile fields",
      message:
        "The API request is running. SmartHire will only mark it successful after validating and saving the structured result.",
    };
  if (resource.status === "REVIEW_READY" || resource.status === "CONFIRMED")
    return {
      tone: "success",
      badge: "Success",
      title: "OpenAI parsing completed",
      message:
        "A private draft is ready. Review every suggested field before applying it to your profile.",
    };
  if (resource.status === "PARSE_FAILED")
    return {
      tone: "error",
      badge: resource.failure?.code ?? "API error",
      title: "OpenAI parsing could not finish",
      message:
        resource.failure?.message ??
        "The provider request failed safely. Retry or update your profile manually.",
    };
  return {
    tone: "preparing",
    badge: "Preparing",
    title: "SmartHire is preparing the CV for OpenAI",
    message:
      "Virus scanning and local text extraction happen first. OpenAI has not been called at this stage.",
  };
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
  const router = useRouter();
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
    const schedule = (pollingAfterMs: number) => {
      const delay = document.hidden
        ? Math.max(pollingAfterMs, 10_000)
        : pollingAfterMs;
      timer = setTimeout(() => {
        void refreshStatus()
          .then((next) => {
            if (!active || !next.pollingAfterMs) return;
            schedule(next.pollingAfterMs);
          })
          .catch(() => {
            if (!active) return;
            setPollError(
              "Status could not be refreshed. SmartHire will keep trying.",
            );
            schedule(pollingAfterMs);
          });
      }, delay);
    };
    schedule(current.pollingAfterMs);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [current.pollingAfterMs, refreshStatus]);

  useEffect(() => {
    if (current.status !== "REVIEW_READY") return;
    const reviewUrl = `/profile/cv-imports/${current.uploadId}/review`;
    router.prefetch(reviewUrl);
    const redirect = setTimeout(() => router.replace(reviewUrl), 320);
    return () => clearTimeout(redirect);
  }, [current.status, current.uploadId, router]);

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
      if (response.status === 401) throw new Error("CV_SESSION_EXPIRED");
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
    if (response.status === 401) throw new Error("CV_SESSION_EXPIRED");
    if (response.status !== 204) throw new Error("CV_CONSENT_REVOKE_FAILED");
    await refreshStatus();
  }, [csrfProof, current.uploadId, refreshStatus]);

  const label = current.status.replaceAll("_", " ").toLowerCase();
  const availableActions = current.availableActions ?? [];
  const aiStatus = aiPresentation(current);
  const stages = (
    current.parserClass === "EXTERNAL_OPENAI"
      ? [
          "UPLOAD",
          "VALIDATE",
          "SCAN",
          "EXTRACT",
          ...(current.ocr ? (["OCR"] as const) : []),
          "CONSENT",
          "PARSE",
          "REVIEW",
        ]
      : [
          "UPLOAD",
          "VALIDATE",
          "SCAN",
          "EXTRACT",
          ...(current.ocr ? (["OCR"] as const) : []),
          "PARSE",
          "REVIEW",
        ]
  ) as readonly (keyof typeof stageLabels)[];
  const activeStage = visualStage(current);
  const activeStageIndex = Math.max(0, stages.indexOf(activeStage));
  const failed =
    current.status.endsWith("_FAILED") || current.status === "INFECTED";
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
        role={
          !aiStatus && !hasFailureRecovery && current.stage
            ? "status"
            : undefined
        }
        aria-live={
          !aiStatus && !hasFailureRecovery && current.stage
            ? "polite"
            : undefined
        }
      >
        <strong>{label}</strong>
        {current.stage
          ? ` — ${
              current.parserClass === "EXTERNAL_OPENAI"
                ? "OpenAI parser"
                : "SmartHire parser"
            }, stage ${activeStage.toLowerCase()}.`
          : ". Content is unavailable."}
      </p>
      {aiStatus ? (
        <div
          key={`${current.status}:${aiStatus.tone}`}
          className={styles.aiStatus}
          data-tone={aiStatus.tone}
          role={aiStatus.tone === "error" ? "alert" : "status"}
          aria-live={aiStatus.tone === "error" ? "assertive" : "polite"}
          data-testid="openai-status"
        >
          <span className={styles.aiIndicator} aria-hidden="true">
            <span />
          </span>
          <div className={styles.aiCopy}>
            <small>EXTERNAL OPENAI PARSER</small>
            <strong>{aiStatus.title}</strong>
            <p>{aiStatus.message}</p>
          </div>
          <span className={styles.aiBadge}>{aiStatus.badge}</span>
        </div>
      ) : null}
      {current.stage ? (
        <ol className={styles.timeline} aria-label="Processing timeline">
          {stages.map((stage, index) => {
            const state = timelineState({
              index,
              currentIndex: activeStageIndex,
              failed,
            });
            return (
              <li
                key={stage}
                data-state={state}
                aria-current={
                  state === "current" || state === "error" ? "step" : undefined
                }
              >
                <span className={styles.timelineMarker} aria-hidden="true">
                  {state === "complete" ? "✓" : index + 1}
                </span>
                <span>
                  {state === "current" ? "Current: " : ""}
                  {state === "error" ? "Failed: " : ""}
                  {stageLabels[stage]}
                </span>
              </li>
            );
          })}
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
