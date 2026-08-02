"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CvDraftComparison,
  CvEditableProposals,
  CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";
import type { z } from "zod";
import {
  cvConflictLatestSchema,
  type CvApiError,
} from "@/shared/contracts/cv-import/common";
import { cvConfirmationReceiptSchema } from "@/shared/contracts/cv-import/review";

type Receipt = z.infer<typeof cvConfirmationReceiptSchema>;
type ConflictLatest = z.infer<typeof cvConflictLatestSchema>;
export type CvReviewFieldError = CvApiError["error"]["fieldErrors"][number];

type SafeApiError = Readonly<{
  error?: Readonly<{
    code?: string;
    message?: string;
    fieldErrors?: CvReviewFieldError[];
    latest?: ConflictLatest | null;
  }>;
}>;

const fieldLabels: Readonly<Record<string, string>> = {
  company: "Company",
  degree: "Degree",
  description: "Description",
  endDate: "End date",
  field: "Field of study",
  headline: "Headline",
  institution: "Institution",
  location: "Location",
  phone: "Phone number",
  startDate: "Start date",
  summary: "Summary",
  title: "Job title",
  url: "Social link",
  value: "Value",
};

function fieldLabel(path: string) {
  if (path.includes(".skills.")) return "Skill";
  if (path.includes(".socialLinks.")) return "Social link";
  const segment = path.split(".").at(-1) ?? "value";
  return fieldLabels[segment] ?? segment.replace(/([a-z])([A-Z])/gu, "$1 $2");
}

export function presentCvReviewFieldError(
  fieldError: CvReviewFieldError,
): CvReviewFieldError {
  const genericMessage = [
    "Enter a valid value.",
    "This field is required.",
    "This value is invalid.",
  ].includes(fieldError.message);
  if (!genericMessage) return fieldError;
  const label = fieldLabel(fieldError.path);
  const message =
    {
      CURRENT_HAS_END: `${label} must be empty for a current entry.`,
      DATE: `${label} must be a valid date.`,
      DATE_RANGE: `${label} must be after the start date and cannot be in the future.`,
      DUPLICATE: `${label} duplicates another proposed value.`,
      FORMAT: `${label} has an invalid format.`,
      FUTURE: `${label} cannot be in the future.`,
      INCOMPLETE: `${label} must include a complete profile URL.`,
      LENGTH: `${label} has an invalid length.`,
      REQUIRED: fieldError.path.endsWith("endDate")
        ? `${label} is required unless the entry is current.`
        : `${label} is required.`,
      URL: `${label} must be a valid http or https URL.`,
    }[fieldError.code] ?? fieldError.message;
  return { ...fieldError, message };
}

function saveErrorSummary(
  message: string,
  fieldErrors: readonly CvReviewFieldError[],
) {
  if (!fieldErrors.length) return message;
  const first = fieldErrors[0]?.message ?? message;
  return fieldErrors.length === 1
    ? first
    : `${first} Check ${fieldErrors.length} highlighted fields.`;
}

export type CvReviewConflict = Readonly<{
  code: "DRAFT_REVISION_CONFLICT" | "PROFILE_REVISION_CONFLICT";
  message: string;
  latest: ConflictLatest | null;
}>;

function newRequestKey() {
  return `cv-confirm-${crypto.randomUUID()}`;
}

async function safeError(response: Response): Promise<SafeApiError> {
  try {
    return (await response.json()) as SafeApiError;
  } catch {
    return {};
  }
}

export function useCvDraftReview(input: {
  initial: CvDraftComparison;
  csrfProof: string;
}) {
  const [authoritative, setAuthoritative] = useState(input.initial);
  const [proposals, setProposals] = useState<CvEditableProposals>(
    input.initial.proposals,
  );
  const [decisions, setDecisions] = useState<CvReviewDecisions>(
    input.initial.reviewDecisions,
  );
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"save" | "confirm" | "reload" | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CvReviewFieldError[]>([]);
  const [conflict, setConflict] = useState<CvReviewConflict | null>(null);
  const [latestComparison, setLatestComparison] =
    useState<CvDraftComparison | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const confirmationKey = useRef(newRequestKey());
  const activeOperation = useRef<"save" | "confirm" | "reload" | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mutateProposals = useCallback(
    (
      next:
        | CvEditableProposals
        | ((value: CvEditableProposals) => CvEditableProposals),
    ) => {
      setProposals(next);
      setDirty(true);
      setMessage(null);
      setError(null);
    },
    [],
  );

  const mutateDecisions = useCallback(
    (
      next:
        | CvReviewDecisions
        | ((value: CvReviewDecisions) => CvReviewDecisions),
    ) => {
      setDecisions(next);
      setDirty(true);
      setMessage(null);
      setError(null);
    },
    [],
  );

  const applyAuthoritative = useCallback((next: CvDraftComparison) => {
    setAuthoritative(next);
    setProposals(next.proposals);
    setDecisions(next.reviewDecisions);
    setDirty(false);
    setConflict(null);
    setLatestComparison(null);
    setError(null);
    setFieldErrors([]);
  }, []);

  const loadLatest = useCallback(async () => {
    const response = await fetch(
      `/api/account/cv-drafts/${authoritative.draftId}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (!response.ok) throw new Error("The latest review could not be loaded.");
    return (await response.json()) as CvDraftComparison;
  }, [authoritative.draftId]);

  const clearFieldErrors = useCallback((paths: readonly string[]) => {
    if (!paths.length) return;
    const selected = new Set(paths);
    setFieldErrors((current) =>
      current.filter((fieldError) => !selected.has(fieldError.path)),
    );
  }, []);

  const save = useCallback(async () => {
    if (activeOperation.current || conflict) return false;
    activeOperation.current = "save";
    setPending("save");
    setError(null);
    setMessage(null);
    setFieldErrors([]);
    try {
      const response = await fetch(
        `/api/account/cv-drafts/${authoritative.draftId}`,
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": input.csrfProof,
          },
          body: JSON.stringify({
            baseDraftRevision: authoritative.draftRevision,
            reviewedProfileRevision: authoritative.currentProfile.revision,
            proposals,
            reviewDecisions: decisions,
          }),
        },
      );
      if (!response.ok) {
        const failure = await safeError(response);
        const code = failure.error?.code;
        if (
          code === "DRAFT_REVISION_CONFLICT" ||
          code === "PROFILE_REVISION_CONFLICT"
        ) {
          setConflict({
            code,
            message:
              failure.error?.message ??
              "The review changed in another session.",
            latest: failure.error?.latest ?? null,
          });
          setLatestComparison(null);
          return false;
        }
        const nextFieldErrors = (failure.error?.fieldErrors ?? []).map(
          presentCvReviewFieldError,
        );
        const summary = saveErrorSummary(
          failure.error?.message ?? "The review could not be saved.",
          nextFieldErrors,
        );
        setFieldErrors(nextFieldErrors);
        setError(summary);
        return false;
      }
      const next = await loadLatest();
      applyAuthoritative(next);
      confirmationKey.current = newRequestKey();
      setMessage("Review saved.");
      return true;
    } catch (caught) {
      const summary =
        caught instanceof Error
          ? caught.message
          : "The review could not be saved.";
      setError(summary);
      setFieldErrors([]);
      return false;
    } finally {
      activeOperation.current = null;
      setPending(null);
    }
  }, [
    applyAuthoritative,
    authoritative.currentProfile.revision,
    authoritative.draftId,
    authoritative.draftRevision,
    conflict,
    decisions,
    input.csrfProof,
    loadLatest,
    proposals,
  ]);

  const confirm = useCallback(async () => {
    if (
      activeOperation.current ||
      conflict ||
      dirty ||
      !decisions.reviewComplete
    )
      return null;
    activeOperation.current = "confirm";
    setPending("confirm");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/account/cv-drafts/${authoritative.draftId}/confirm`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
            "idempotency-key": confirmationKey.current,
            "x-csrf-token": input.csrfProof,
          },
          body: JSON.stringify({
            draftRevision: authoritative.draftRevision,
            sourceProfileRevision: authoritative.sourceProfileRevision,
            reviewedProfileRevision: authoritative.reviewedProfileRevision,
          }),
        },
      );
      if (!response.ok) {
        const failure = await safeError(response);
        const code = failure.error?.code;
        if (
          code === "DRAFT_REVISION_CONFLICT" ||
          code === "PROFILE_REVISION_CONFLICT"
        ) {
          setConflict({
            code,
            message:
              failure.error?.message ??
              "The review changed before confirmation.",
            latest: failure.error?.latest ?? null,
          });
          setLatestComparison(null);
          return null;
        }
        throw new Error(
          failure.error?.message ?? "The profile could not be updated.",
        );
      }
      const next = cvConfirmationReceiptSchema.parse(await response.json());
      setReceipt(next);
      setMessage("CV changes were confirmed and applied to your profile.");
      return next;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The profile could not be updated.",
      );
      return null;
    } finally {
      activeOperation.current = null;
      setPending(null);
    }
  }, [
    authoritative,
    conflict,
    decisions.reviewComplete,
    dirty,
    input.csrfProof,
  ]);

  const compareLatest = useCallback(async () => {
    if (activeOperation.current) return null;
    activeOperation.current = "reload";
    setPending("reload");
    setError(null);
    try {
      const next = await loadLatest();
      setLatestComparison(next);
      setConflict((current) =>
        current
          ? {
              ...current,
              latest: {
                draftRevision: next.draftRevision,
                profileRevision: next.currentProfile.revision,
                draftUpdatedAt: current.latest?.draftUpdatedAt ?? null,
                profileUpdatedAt: current.latest?.profileUpdatedAt ?? null,
              },
            }
          : null,
      );
      setMessage(
        "Latest saved review loaded for comparison; your edits remain in memory.",
      );
      return next;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reload failed.");
      return null;
    } finally {
      activeOperation.current = null;
      setPending(null);
    }
  }, [loadLatest]);

  const reapplyLatest = useCallback(() => {
    if (activeOperation.current || !conflict || !latestComparison) return false;
    setAuthoritative(latestComparison);
    setLatestComparison(null);
    setConflict(null);
    setDirty(true);
    setError(null);
    setMessage(
      "Your in-memory edits are ready to save against the latest review.",
    );
    confirmationKey.current = newRequestKey();
    return true;
  }, [conflict, latestComparison]);

  const discardAndReload = useCallback(async () => {
    if (activeOperation.current) return false;
    activeOperation.current = "reload";
    setPending("reload");
    try {
      const next = await loadLatest();
      applyAuthoritative(next);
      setMessage("Latest saved review loaded.");
      confirmationKey.current = newRequestKey();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reload failed.");
      return false;
    } finally {
      activeOperation.current = null;
      setPending(null);
    }
  }, [applyAuthoritative, loadLatest]);

  return useMemo(
    () => ({
      authoritative,
      proposals,
      decisions,
      dirty,
      pending,
      message,
      error,
      fieldErrors,
      conflict,
      latestComparison,
      receipt,
      setProposals: mutateProposals,
      setDecisions: mutateDecisions,
      clearFieldErrors,
      save,
      confirm,
      compareLatest,
      reapplyLatest,
      discardAndReload,
    }),
    [
      authoritative,
      clearFieldErrors,
      compareLatest,
      confirm,
      conflict,
      decisions,
      dirty,
      discardAndReload,
      error,
      fieldErrors,
      latestComparison,
      message,
      mutateDecisions,
      mutateProposals,
      pending,
      proposals,
      receipt,
      reapplyLatest,
      save,
    ],
  );
}
