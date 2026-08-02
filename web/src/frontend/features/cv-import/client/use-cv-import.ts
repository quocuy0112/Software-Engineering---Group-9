"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    | "COMPLETE"
    | "ERROR";
  percentage: number;
  message: string;
  uploadId: string | null;
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
  deleteAfter?: string | null;
  deletedAt?: string | null;
  failure?: Readonly<{
    message: string;
    suggestedActions: readonly string[];
  }> | null;
}>;

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
    message: "Choose a PDF or DOCX CV to begin.",
    uploadId: null,
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
      const resource = await loadStatus(uploadId);
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
      setProgress({
        state: terminal ? "COMPLETE" : "PROCESSING",
        percentage: terminal ? 100 : 95,
        message: terminal
          ? terminalMessage(resource)
          : candidateCleanupPending
            ? "Deletion accepted. Content is unavailable while protected cleanup continues."
            : `Processing stage: ${statusLabel("stage" in resource ? resource.stage : resource.status)}.`,
        uploadId,
      });
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
        message: "Reserving secure CV storage…",
        uploadId: null,
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
        if (!reservationResponse.ok) throw new Error("CV_RESERVATION_FAILED");
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
              message: `Uploading CV: ${percentage}%.`,
              uploadId: reservation.uploadId,
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
          percentage: 95,
          message: "Upload complete. Validating and processing CV…",
          uploadId: reservation.uploadId,
        });
        await poll(reservation.uploadId);
      } catch (error) {
        setProgress((current) => ({
          ...current,
          state: "ERROR",
          message:
            error instanceof Error && error.message === "CV_UPLOAD_ABORTED"
              ? "CV upload cancelled."
              : "CV upload could not be completed.",
        }));
        throw error;
      }
    },
    [input.csrfProof, poll, stop],
  );

  return Object.freeze({ progress, upload, cancel: stop, loadStatus });
}
