"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import {
  cvImportStatusResponseSchema,
  type CreateCvImportRequest,
} from "@/shared/contracts/cv-import/upload";

export type CvUploadProgress = Readonly<{
  state:
    | "IDLE"
    | "RESERVING"
    | "UPLOADING"
    | "PROCESSING"
    | "AWAITING_CONSENT"
    | "AI_PENDING"
    | "AI_PROCESSING"
    | "STATUS_ERROR"
    | "SUCCESS"
    | "COMPLETE"
    | "ERROR";
  percentage: number;
  title: string;
  message: string;
  uploadId: string | null;
  parserClass: CvParserClass | null;
}>;

function requestKey() {
  return `cv-${crypto.randomUUID()}`;
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

type CvStatusResource = Readonly<{
  status: string;
  stage?: string;
  parserClass?: CvParserClass;
  deleteAfter?: string | null;
  deletedAt?: string | null;
  failure?: Readonly<{
    code?: string;
    message: string;
    suggestedActions: readonly string[];
  }> | null;
}>;

const failureStatuses = new Set([
  "VALIDATION_FAILED",
  "INFECTED",
  "SCAN_FAILED",
  "EXTRACTION_FAILED",
  "PARSE_FAILED",
]);

function progressPercentage(resource: CvStatusResource): number {
  if (failureStatuses.has(resource.status)) return 100;
  if (
    ["REVIEW_READY", "CONFIRMED", "DELETED", "EXPIRED"].includes(
      resource.status,
    )
  )
    return 100;
  const stage = "stage" in resource ? resource.stage : undefined;
  return (
    {
      UPLOAD: 10,
      VALIDATE: 20,
      SCAN: 35,
      EXTRACT: 55,
      CONSENT: 65,
      PARSE: resource.status === "PARSING" ? 90 : 78,
      REVIEW: 100,
      COMPLETE: 100,
      TERMINAL: 100,
    }[stage ?? ""] ?? 15
  );
}

function activeProgress(
  resource: CvStatusResource,
): Pick<
  CvUploadProgress,
  "state" | "title" | "message" | "percentage" | "parserClass"
> {
  const external = resource.parserClass === "EXTERNAL_OPENAI";
  const percentage = progressPercentage(resource);
  if (resource.status === "REVIEW_READY" || resource.status === "CONFIRMED") {
    return {
      state: "SUCCESS",
      percentage,
      title: external ? "OpenAI parsing completed" : "CV parsing completed",
      message:
        "Your private draft is ready. Review it before applying changes.",
      parserClass: resource.parserClass ?? null,
    };
  }
  if (failureStatuses.has(resource.status)) {
    return {
      state: "ERROR",
      percentage,
      title:
        external && resource.status === "PARSE_FAILED"
          ? "OpenAI parsing failed"
          : "CV processing stopped",
      message: terminalMessage(resource),
      parserClass: resource.parserClass ?? null,
    };
  }
  if (external && resource.status === "AWAITING_CONSENT") {
    return {
      state: "AWAITING_CONSENT",
      percentage,
      title: "Waiting for your consent",
      message:
        "OpenAI has not received any CV text. Open the import status to review and grant consent.",
      parserClass: resource.parserClass ?? null,
    };
  }
  if (external && resource.status === "PARSE_QUEUED") {
    return {
      state: "AI_PENDING",
      percentage,
      title: "OpenAI request queued",
      message: "Consent is valid. The worker is preparing the AI request.",
      parserClass: resource.parserClass ?? null,
    };
  }
  if (external && resource.status === "PARSING") {
    return {
      state: "AI_PROCESSING",
      percentage,
      title: "OpenAI is parsing your CV",
      message:
        "The API request is in progress. Keep this page open for live status.",
      parserClass: resource.parserClass ?? null,
    };
  }
  return {
    state: "PROCESSING",
    percentage,
    title: external
      ? "Preparing CV for OpenAI"
      : "SmartHire is processing your CV",
    message: external
      ? `SmartHire is completing the ${statusLabel(resource.stage ?? resource.status)} stage. OpenAI has not been called yet.`
      : `Current stage: ${statusLabel(resource.stage ?? resource.status)}.`,
    parserClass: resource.parserClass ?? null,
  };
}

function terminalMessage(resource: CvStatusResource): string {
  const guidance: string[] = [];
  if (resource.failure?.suggestedActions.includes("REPLACE_DOCUMENT"))
    guidance.push("Replace this CV with another PDF or DOCX.");
  if (resource.failure?.suggestedActions.includes("RETRY"))
    guidance.push("Retry secure processing.");
  if (resource.failure?.suggestedActions.includes("MANUAL_PROFILE"))
    guidance.push("Or enter your profile manually.");
  return [
    `CV processing status: ${statusLabel(resource.status)}.`,
    resource.failure?.message,
    ...guidance,
  ]
    .filter(Boolean)
    .join(" ");
}

export function useCvImport(input: { csrfProof: string }) {
  const [progress, setProgress] = useState<CvUploadProgress>({
    state: "IDLE",
    percentage: 0,
    title: "CV import ready",
    message: "Choose a PDF or DOCX CV to begin.",
    uploadId: null,
    parserClass: null,
  });
  const activeRequest = useRef<XMLHttpRequest | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const loadStatus = useCallback(async (uploadId: string) => {
    const response = await fetch(`/api/account/cv-imports/${uploadId}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("CV_STATUS_FAILED");
    return cvImportStatusResponseSchema.parse(await response.json());
  }, []);

  const poll = useCallback(
    async function next(uploadId: string): Promise<void> {
      let resource: Awaited<ReturnType<typeof loadStatus>>;
      try {
        resource = await loadStatus(uploadId);
      } catch {
        setProgress((current) => ({
          ...current,
          state: "STATUS_ERROR",
          title: "Status API temporarily unavailable",
          message:
            "SmartHire could not refresh this status. Background processing may still be running; retrying automatically.",
          uploadId,
        }));
        pollTimer.current = setTimeout(() => void next(uploadId), 2_000);
        return;
      }
      const cleanupDeadline = resource.deleteAfter
        ? new Date(resource.deleteAfter).getTime()
        : Number.NaN;
      const candidateCleanupPending =
        resource.status === "CANCELLED" &&
        resource.deletedAt === null &&
        !Number.isNaN(cleanupDeadline) &&
        Date.now() < cleanupDeadline;
      const terminal =
        [
          "REVIEW_READY",
          "VALIDATION_FAILED",
          "INFECTED",
          "SCAN_FAILED",
          "EXTRACTION_FAILED",
          "PARSE_FAILED",
          "CONFIRMED",
          "DELETED",
          "EXPIRED",
        ].includes(resource.status) ||
        (resource.status === "CANCELLED" && !candidateCleanupPending);
      const nextProgress = activeProgress(resource);
      setProgress(
        candidateCleanupPending
          ? {
              state: "PROCESSING",
              percentage: nextProgress.percentage,
              title: "Protected deletion in progress",
              message:
                "Content is unavailable while protected cleanup continues.",
              uploadId,
              parserClass: nextProgress.parserClass,
            }
          : terminal &&
              !failureStatuses.has(resource.status) &&
              !["REVIEW_READY", "CONFIRMED"].includes(resource.status)
            ? {
                state: "COMPLETE",
                percentage: 100,
                title: "CV import finished",
                message: terminalMessage(resource),
                uploadId,
                parserClass: nextProgress.parserClass,
              }
            : { ...nextProgress, uploadId },
      );
      if (!terminal)
        pollTimer.current = setTimeout(() => void next(uploadId), 2_000);
    },
    [loadStatus],
  );

  const upload = useCallback(
    async (file: File, parserClass: CreateCvImportRequest["parserClass"]) => {
      stop();
      const idempotencyKey = requestKey();
      setProgress({
        state: "RESERVING",
        percentage: 0,
        title:
          parserClass === "EXTERNAL_OPENAI"
            ? "Preparing an OpenAI import"
            : "Preparing a SmartHire import",
        message: "Reserving encrypted temporary storage...",
        uploadId: null,
        parserClass,
      });
      try {
        const reservationResponse = await fetch("/api/account/cv-imports", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
            "x-csrf-token": input.csrfProof,
          },
          body: JSON.stringify({
            displayFilename: file.name,
            declaredMediaType: file.type,
            declaredBytes: file.size,
            parserClass,
          }),
        });
        if (!reservationResponse.ok)
          throw new Error(
            parserClass === "EXTERNAL_OPENAI"
              ? "OpenAI parsing is not available. Check the server key and parser configuration."
              : "SmartHire deterministic parsing is not available in this environment.",
          );
        const reservation = (await reservationResponse.json()) as {
          uploadId: string;
          contentUrl: string;
        };
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          activeRequest.current = request;
          request.open("PUT", reservation.contentUrl);
          request.setRequestHeader("content-type", file.type);
          request.setRequestHeader("idempotency-key", idempotencyKey);
          request.setRequestHeader("x-csrf-token", input.csrfProof);
          request.upload.onprogress = (event) => {
            const percentage = event.lengthComputable
              ? Math.round((event.loaded / event.total) * 90)
              : 0;
            setProgress({
              state: "UPLOADING",
              percentage,
              title: "Uploading encrypted CV",
              message: `Uploading CV: ${percentage}%.`,
              uploadId: reservation.uploadId,
              parserClass,
            });
          };
          request.onerror = () => reject(new Error("CV_UPLOAD_FAILED"));
          request.onabort = () => reject(new Error("CV_UPLOAD_ABORTED"));
          request.onload = () =>
            request.status >= 200 && request.status < 300
              ? resolve()
              : reject(new Error("CV_UPLOAD_FAILED"));
          request.send(file);
        });
        activeRequest.current = null;
        setProgress({
          state: "PROCESSING",
          percentage: 15,
          title: "Upload complete",
          message: "SmartHire is validating and scanning the CV...",
          uploadId: reservation.uploadId,
          parserClass,
        });
        await poll(reservation.uploadId);
      } catch (error) {
        setProgress((current) => ({
          ...current,
          state: "ERROR",
          title: "CV upload failed",
          message:
            error instanceof Error && error.message === "CV_UPLOAD_ABORTED"
              ? "CV upload cancelled."
              : error instanceof Error && !error.message.startsWith("CV_")
                ? error.message
                : "CV upload could not be completed.",
        }));
        throw error;
      }
    },
    [input.csrfProof, poll, stop],
  );

  return Object.freeze({ progress, upload, cancel: stop, loadStatus });
}
