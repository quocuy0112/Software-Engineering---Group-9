"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Inbox,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import type {
  ApplicationStage,
  PipelineStageCount,
  PipelineStagePage,
} from "@/shared/contracts/applications";
import type { PipelineSortDirection } from "./recruitment-pipeline-ui";
import { canSortPipelineStage } from "./recruitment-pipeline-ui";
import { RecruitmentPipelineCard } from "./recruitment-pipeline-card";

type PipelineColumnProps = {
  jobId: string;
  summary: PipelineStageCount;
  page: PipelineStagePage | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onLoadMore: (stage: ApplicationStage) => void;
  onRetry: (stage: ApplicationStage) => void;
  onChangeStage?: Parameters<
    typeof RecruitmentPipelineCard
  >[0]["onChangeStage"];
  onViewAssessment?: Parameters<
    typeof RecruitmentPipelineCard
  >[0]["onViewAssessment"];
  sortDirection?: PipelineSortDirection;
  sortMenuOpen?: boolean;
  onToggleSortMenu?: (stage: ApplicationStage) => void;
  onSortDirectionChange?: (
    stage: ApplicationStage,
    direction: PipelineSortDirection,
  ) => void;
  filterActive?: boolean;
  loadedItemCount?: number;
};

const lockedStages = new Set<ApplicationStage>([
  "OFFERED",
  "WAITLISTED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
]);

const sortLabels: Record<PipelineSortDirection, string> = {
  none: "Sort",
  asc: "Low \u2192 High",
  desc: "High \u2192 Low",
};

const sortOptionLabels: Record<PipelineSortDirection, string> = {
  none: "Default",
  asc: "Score: Low \u2192 High",
  desc: "Score: High \u2192 Low",
};

export function RecruitmentPipelineColumn({
  jobId,
  summary,
  page,
  loading,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
  onChangeStage,
  onViewAssessment,
  sortDirection = "none",
  sortMenuOpen = false,
  onToggleSortMenu,
  onSortDirectionChange,
  filterActive = false,
  loadedItemCount = page?.items.length ?? 0,
}: PipelineColumnProps) {
  const locked = lockedStages.has(summary.stage);
  const droppable = useDroppable({
    id: summary.stage,
    data: { stage: summary.stage },
    disabled: locked,
  });
  const { setNodeRef, isOver } = droppable;
  const headingId = `pipeline-${summary.stage.toLowerCase()}-heading`;
  const canSort = canSortPipelineStage(summary.stage);
  const visibleItems = page?.items ?? [];
  const noFilterMatch =
    !loading &&
    !error &&
    filterActive &&
    loadedItemCount > 0 &&
    visibleItems.length === 0;

  return (
    <section
      ref={setNodeRef}
      className={`pipeline-column${isOver ? "is-drag-over" : ""}${locked ? "is-locked" : ""}`}
      role="region"
      aria-labelledby={headingId}
      aria-disabled={locked || undefined}
      data-stage={summary.stage}
    >
      <header className="pipeline-column__header">
        <div className="pipeline-column__heading">
          <h2 id={headingId} aria-describedby={`${headingId}-count`}>
            {summary.label}
          </h2>
          <span
            id={`${headingId}-count`}
            aria-label={`${summary.count} candidates`}
          >
            {summary.count}
          </span>
        </div>
        <div className="pipeline-column__header-tools">
          {canSort && onToggleSortMenu && onSortDirectionChange ? (
            <div className="pipeline-column__sort">
              <button
                type="button"
                className={
                  sortDirection === "none"
                    ? "pipeline-sort-button"
                    : "pipeline-sort-button is-active"
                }
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
                aria-label={`Sort ${summary.label} candidates`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSortMenu(summary.stage);
                }}
              >
                <SlidersHorizontal aria-hidden="true" />
                <span>{sortLabels[sortDirection]}</span>
              </button>
              {sortMenuOpen ? (
                <div
                  className="pipeline-sort-menu"
                  role="menu"
                  aria-label={`${summary.label} sort options`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {(["none", "asc", "desc"] as const).map((direction) => (
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortDirection === direction}
                      className={
                        sortDirection === direction
                          ? "pipeline-sort-option is-selected"
                          : "pipeline-sort-option"
                      }
                      key={direction}
                      onClick={() =>
                        onSortDirectionChange(summary.stage, direction)
                      }
                    >
                      {direction === "none" ? (
                        <SlidersHorizontal aria-hidden="true" />
                      ) : direction === "asc" ? (
                        <ArrowUp aria-hidden="true" />
                      ) : (
                        <ArrowDown aria-hidden="true" />
                      )}
                      <span>{sortOptionLabels[direction]}</span>
                      {sortDirection === direction ? (
                        <Check aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {locked ? <LockKeyhole aria-label="Stage is locked" /> : null}
        </div>
      </header>
      {loading ? (
        <p role="status">Loading applications...</p>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => onRetry(summary.stage)}>
            Retry
          </button>
        </div>
      ) : !visibleItems.length ? (
        <div className="pipeline-column__empty">
          <Inbox aria-hidden="true" />
          <span aria-label="No applications in this stage.">
            {noFilterMatch
              ? "No loaded candidates match the current filter."
              : "No candidates yet."}
          </span>
        </div>
      ) : (
        <div className="pipeline-column__cards" data-card-stack>
          {visibleItems.map((card) => (
            <RecruitmentPipelineCard
              key={card.applicationId}
              card={card}
              jobId={jobId}
              onChangeStage={onChangeStage}
              onViewAssessment={onViewAssessment}
            />
          ))}
        </div>
      )}
      {page?.nextCursor ? (
        <button
          type="button"
          onClick={() => onLoadMore(summary.stage)}
          disabled={loadingMore}
          className="pipeline-column__load-more"
        >
          {loadingMore
            ? "Loading more..."
            : `Load more ${summary.label} applications`}
        </button>
      ) : null}
    </section>
  );
}
