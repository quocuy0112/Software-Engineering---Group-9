"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  pipelineStagePageSchema,
  pipelineWithdrawnPageSchema,
  type ApplicationStage,
  type PipelineBoardColumnStage,
  type PipelineColumnSummary,
  type PipelineApplicationCard,
} from "@/shared/contracts/applications";
import {
  pipelineScoreForCard,
  pipelineTierForCard,
} from "./recruitment-pipeline-ui";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterApplicationsCopy } from "./recruiter-applications-copy";

export type ViewAllPipelineStage = PipelineBoardColumnStage;

export type ActivePipelineStage = ApplicationStage;

type BulkAction =
  | {
      kind: "move" | "waitlist";
      label: string;
      target: ApplicationStage;
    }
  | {
      kind: "reject";
      label: string;
    };

const bulkActions: Record<ViewAllPipelineStage, readonly BulkAction[]> = {
  APPLIED: [
    { kind: "waitlist", label: "Waitlist", target: "WAITLISTED" },
    { kind: "reject", label: "Reject" },
  ],
  VIEWED: [
    { kind: "move", label: "Move to shortlist", target: "SHORTLISTED" },
    { kind: "waitlist", label: "Waitlist", target: "WAITLISTED" },
    { kind: "reject", label: "Reject" },
  ],
  SHORTLISTED: [
    { kind: "move", label: "Move to interview", target: "INTERVIEWING" },
    { kind: "waitlist", label: "Waitlist", target: "WAITLISTED" },
    { kind: "reject", label: "Reject" },
  ],
  INTERVIEWING: [
    { kind: "move", label: "Send offer", target: "OFFERED" },
    { kind: "waitlist", label: "Waitlist", target: "WAITLISTED" },
    { kind: "reject", label: "Reject" },
  ],
  OFFERED: [],
  HIRED: [],
  OFFER_DECLINED: [],
  REJECTED: [],
  WAITLISTED: [],
  WITHDRAWN: [],
};

function formatSubmissionDate(value: string, locale: "vi" | "en") {
  return new Date(value).toLocaleDateString(
    locale === "vi" ? "vi-VN" : "en-GB",
  );
}

export function RecruitmentPipelineViewAllModal({
  jobId,
  summary,
  canMoveStages,
  canReject,
  onClose,
  onBulkMove,
  onBulkReject,
}: {
  jobId: string;
  summary: PipelineColumnSummary;
  canMoveStages: boolean;
  canReject: boolean;
  onClose: () => void;
  onBulkMove: (
    cards: readonly PipelineApplicationCard[],
    targetStage: ApplicationStage,
  ) => Promise<void>;
  onBulkReject: (cards: readonly PipelineApplicationCard[]) => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = useMemo(
    () => recruiterApplicationsCopy(locale).pipeline,
    [locale],
  );
  const [candidates, setCandidates] = useState<PipelineApplicationCard[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const stageActions = bulkActions[summary.stage].map((action) => ({
    ...action,
    label:
      action.kind === "reject"
        ? copy.reject
        : action.kind === "waitlist"
          ? copy.waitlist
          : action.target === "SHORTLISTED"
            ? copy.moveToShortlist
            : action.target === "INTERVIEWING"
              ? copy.moveToInterview
              : copy.sendOffer,
  }));
  const displayLabel = copy.stageLabels[summary.stage] ?? summary.label;
  const tierLabels = {
    strong: copy.strong,
    review: copy.review,
    low: copy.low,
    pending: copy.pending,
  } as const;
  const readOnlyList = stageActions.length === 0;

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    const returnTarget = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])",
        )
        ?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTarget?.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFullList() {
      setLoading(true);
      setError(null);
      setCandidates([]);
      setSelectedIds(new Set());

      try {
        const items: PipelineApplicationCard[] = [];
        const seenCursors = new Set<string>();
        let cursor: string | undefined;

        do {
          const params = new URLSearchParams({ limit: "100" });
          if (cursor) params.set("cursor", cursor);
          const path =
            summary.stage === "WITHDRAWN" ? "withdrawn" : summary.stage;
          const response = await fetch(
            "/api/recruiter/jobs/" +
              encodeURIComponent(jobId) +
              "/applications/pipeline/" +
              encodeURIComponent(path) +
              "?" +
              params.toString(),
            { cache: "no-store" },
          );
          const json = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(
              locale === "en" && typeof json?.message === "string"
                ? json.message
                : copy.unavailable,
            );
          }

          const page =
            summary.stage === "WITHDRAWN"
              ? pipelineWithdrawnPageSchema.parse(json)
              : pipelineStagePageSchema.parse(json);
          if (page.stage !== summary.stage) {
            throw new Error(copy.unexpectedStage);
          }
          items.push(...page.items);

          if (
            page.nextCursor &&
            !seenCursors.has(page.nextCursor) &&
            page.nextCursor !== cursor
          ) {
            seenCursors.add(page.nextCursor);
            cursor = page.nextCursor;
          } else {
            cursor = undefined;
          }
        } while (cursor);

        if (!cancelled) {
          const unique = [
            ...new Map(
              items.map((item) => [item.applicationId, item]),
            ).values(),
          ];
          setCandidates(unique);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            locale === "en" && cause instanceof Error
              ? cause.message
              : copy.unavailable,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFullList();
    return () => {
      cancelled = true;
    };
  }, [copy, jobId, locale, reloadToken, summary.stage]);

  const selectedCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          selectedIds.has(candidate.applicationId) &&
          candidate.withdrawalOutcome !== "CANDIDATE_WITHDRAWN",
      ),
    [candidates, selectedIds],
  );
  const selectableCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) => candidate.withdrawalOutcome !== "CANDIDATE_WITHDRAWN",
      ),
    [candidates],
  );
  const selectedCount = selectedCandidates.length;
  const allSelected =
    selectableCandidates.length > 0 &&
    selectedCount === selectableCandidates.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const toggleCandidate = (applicationId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(
            selectableCandidates.map((candidate) => candidate.applicationId),
          ),
    );
  };

  const submitMove = async (
    action: Extract<BulkAction, { kind: "move" | "waitlist" }>,
  ) => {
    if (!selectedCandidates.length || busy) return;
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        copy.confirmBulk(action.label, selectedCount, displayLabel),
      );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await onBulkMove(selectedCandidates, action.target);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The bulk stage change could not be completed.",
      );
      setBusy(false);
    }
  };

  const requestReject = () => {
    if (!selectedCandidates.length || busy || !canReject) return;
    onBulkReject(selectedCandidates);
  };

  return (
    <div
      className="modal-overlay open"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={panelRef}
        id="viewAllModal"
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <div className="modal-eyebrow">
              <span className="dot" aria-hidden="true" />
              {copy.fullList}
            </div>
            <div className="modal-title" id={titleId}>
              {displayLabel}
            </div>
            <div className="modal-subtitle" id={subtitleId}>
              {copy.totalInStage(summary.count)}
            </div>
          </div>
          <button
            type="button"
            className="modal-close view-all-modal__close"
            aria-label={copy.closeFullList}
            onClick={onClose}
            disabled={busy}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {stageActions.length ? (
          <div
            className={`bulk-toolbar view-all-modal__bulk-toolbar${selectedCount > 0 ? "active" : ""}`}
            role="toolbar"
          >
            <div className="bulk-count" aria-live="polite">
              {selectedCount > 0
                ? copy.selected(selectedCount)
                : copy.noneSelected}
            </div>
            <div className="bulk-actions view-all-modal__bulk-actions">
              {stageActions.map((action) =>
                action.kind === "reject" ? (
                  <button
                    key={action.label}
                    type="button"
                    className="bulk-actions-button bulk-danger view-all-modal__bulk-action view-all-modal__bulk-action--reject"
                    disabled={!selectedCount || busy || !canReject}
                    onClick={requestReject}
                  >
                    {action.label}
                  </button>
                ) : (
                  <button
                    key={action.label}
                    type="button"
                    className={`bulk-actions-button ${action.kind === "move" ? "bulk-move" : "bulk-warn"} view-all-modal__bulk-action`}
                    disabled={!selectedCount || busy || !canMoveStages}
                    onClick={() => void submitMove(action)}
                  >
                    {action.label}
                  </button>
                ),
              )}
            </div>
          </div>
        ) : null}

        {readOnlyList ? null : (
          <label className="modal-select-all view-all-modal__select-all">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allSelected}
              disabled={loading || !selectableCandidates.length || busy}
              onChange={toggleAll}
            />
            <span>{copy.selectAll}</span>
          </label>
        )}

        {loading ? (
          <p className="modal-list-state view-all-modal__state" role="status">
            {copy.loadingFullList}
          </p>
        ) : error ? (
          <div className="modal-list-state view-all-modal__state" role="alert">
            <p>{copy.unavailable}</p>
            <button
              type="button"
              onClick={() => setReloadToken((current) => current + 1)}
            >
              {copy.retry}
            </button>
          </div>
        ) : candidates.length ? (
          <div
            className="modal-list view-all-modal__rows"
            role="list"
            aria-label={`${displayLabel} ${copy.candidates}`}
          >
            {candidates.map((candidate) => {
              const tier = pipelineTierForCard(candidate);
              const score = pipelineScoreForCard(candidate);
              const withdrawn =
                candidate.withdrawalOutcome === "CANDIDATE_WITHDRAWN";
              return (
                <label
                  className="modal-row view-all-modal__row"
                  role="listitem"
                  key={candidate.applicationId}
                >
                  {readOnlyList ? null : (
                    <input
                      className="row-checkbox"
                      type="checkbox"
                      checked={selectedIds.has(candidate.applicationId)}
                      disabled={busy || withdrawn}
                      aria-label={copy.selectCandidate(
                        candidate.candidate.displayName,
                      )}
                      onChange={() => toggleCandidate(candidate.applicationId)}
                    />
                  )}
                  <div>
                    <div className="modal-row-name">
                      {candidate.candidate.displayName}
                      {withdrawn ? (
                        <span className="modal-row-status status-withdrawn">
                          {copy.stageLabels.WITHDRAWN}
                        </span>
                      ) : null}
                    </div>
                    <div className="modal-row-date">
                      {copy.submitted(
                        formatSubmissionDate(candidate.submittedAt, locale),
                      )}
                    </div>
                  </div>
                  <div className="modal-row-score">
                    <span className="modal-row-pct view-all-modal__score">
                      {score === null ? "\u2014" : Math.round(score) + "%"}
                    </span>
                    <span
                      className={`modal-row-tier ${tier} view-all-modal__tier-badge view-all-modal__tier-badge--${tier}`}
                      data-tier={tier}
                    >
                      <span className="dot" aria-hidden="true" />
                      {tierLabels[tier]}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="modal-list-state view-all-modal__state">
            {copy.noCandidatesInStage}
          </p>
        )}
      </section>
    </div>
  );
}
