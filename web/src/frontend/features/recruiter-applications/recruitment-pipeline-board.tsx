"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, SlidersHorizontal } from "lucide-react";
import type {
  ApplicationStage,
  PipelineApplicationCard,
  PipelineStageCount,
} from "@/shared/contracts/applications";
import { isTerminalPipelineStage } from "@/shared/contracts/applications";
import { RecruitmentPipelineColumn } from "./recruitment-pipeline-column";
import { RecruitmentPipelineCard } from "./recruitment-pipeline-card";
import { CandidateScoreDrawer } from "./candidate-score-drawer";
import {
  ApplicationStageChangeDialog,
  stageTransitionNeedsDialog,
} from "./application-stage-change-dialog";
import { useRecruitmentPipeline } from "./use-recruitment-pipeline";
import {
  filterPipelineCards,
  sortPipelineCards,
  type PipelineSortDirection,
  type PipelineTierFilter,
} from "./recruitment-pipeline-ui";

const activePipelineStages: ApplicationStage[] = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
];

const outcomeStages: ApplicationStage[] = [
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WAITLISTED",
];

const tierOptions: Array<{ value: PipelineTierFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "strong", label: "Strong match" },
  { value: "review", label: "Review needed" },
  { value: "low", label: "Low match" },
  { value: "pending", label: "Not yet scored" },
];

const defaultSortDirections: Record<ApplicationStage, PipelineSortDirection> = {
  APPLIED: "none",
  VIEWED: "none",
  SHORTLISTED: "none",
  INTERVIEWING: "none",
  OFFERED: "none",
  HIRED: "none",
  OFFER_DECLINED: "none",
  REJECTED: "none",
  WAITLISTED: "none",
};

function dateFilterLabel(filter: PipelineTierFilter, query: string) {
  const tier = tierOptions.find((option) => option.value === filter)?.label;
  if (filter === "all" && !query) return "Showing all loaded candidates.";
  return (
    "Showing loaded candidates filtered by " +
    (tier?.toLocaleLowerCase() ?? "tier") +
    (query ? " and " + query : "") +
    "."
  );
}

export function RecruitmentPipelineBoard({ jobId }: { jobId: string }) {
  const state = useRecruitmentPipeline(jobId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [activeCard, setActiveCard] = useState<PipelineApplicationCard | null>(
    null,
  );
  const [assessmentCard, setAssessmentCard] =
    useState<PipelineApplicationCard | null>(null);
  const [dialog, setDialog] = useState<{
    card: PipelineApplicationCard;
    target?: ApplicationStage;
    intent?: "button" | "drag";
  } | null>(null);
  const [tierFilter, setTierFilter] = useState<PipelineTierFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDirections, setSortDirections] = useState(defaultSortDirections);
  const [openSortMenu, setOpenSortMenu] = useState<ApplicationStage | null>(
    null,
  );
  const returnFocus = useRef<HTMLElement | null>(null);
  const assessmentReturnFocus = useRef<HTMLElement | null>(null);
  const cards = useMemo(
    () =>
      Object.values(state.columns).flatMap(
        (column) => column?.page?.items ?? [],
      ),
    [state.columns],
  );
  const filterActive = tierFilter !== "all" || Boolean(searchQuery.trim());

  useEffect(() => {
    if (openSortMenu === null) return;
    const closeMenu = () => setOpenSortMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [openSortMenu]);

  const visiblePage = (stage: ApplicationStage) => {
    const column = state.columns[stage];
    if (!column?.page) return null;
    const filtered = filterPipelineCards(
      column.page.items,
      tierFilter,
      searchQuery,
    );
    return {
      ...column.page,
      items: sortPipelineCards(filtered, sortDirections[stage]),
    };
  };

  const restoreFocus = (applicationId: string) =>
    window.setTimeout(
      () =>
        document
          .querySelector<HTMLElement>(
            `[data-application-id="${CSS.escape(applicationId)}"]`,
          )
          ?.focus(),
      0,
    );

  const onDragStart = (event: DragStartEvent) => {
    const card =
      cards.find((item) => item.applicationId === String(event.active.id)) ??
      null;
    setActiveCard(card && !isTerminalPipelineStage(card.stage) ? card : null);
    returnFocus.current = document.activeElement as HTMLElement | null;
  };

  const onDragCancel = () => {
    setActiveCard(null);
    setTimeout(() => returnFocus.current?.focus(), 0);
  };

  const moveCard = (
    card: PipelineApplicationCard,
    target: ApplicationStage,
    extras: Parameters<typeof state.move>[2],
    intent: "button" | "drag",
  ) => {
    if (intent === "drag" && state.moveDrag) {
      return state.moveDrag(card, target, extras);
    }
    return state.move(card, target, extras);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const card = activeCard;
    setActiveCard(null);
    const target = event.over?.data.current?.stage as
      | ApplicationStage
      | undefined;
    const dragDestinations = card?.dragDestinations ?? [];
    if (
      !card ||
      isTerminalPipelineStage(card.stage) ||
      !target ||
      target === card.stage ||
      !dragDestinations.includes(target)
    ) {
      setTimeout(() => returnFocus.current?.focus(), 0);
      return;
    }

    returnFocus.current = document.activeElement as HTMLElement | null;
    if (stageTransitionNeedsDialog(target)) {
      setDialog({ card, target, intent: "drag" });
      return;
    }
    void moveCard(card, target, {}, "drag").finally(() =>
      restoreFocus(card.applicationId),
    );
  };

  const requestStageChange = (
    card: PipelineApplicationCard,
    target?: ApplicationStage,
  ) => {
    returnFocus.current = document.activeElement as HTMLElement;
    if (isTerminalPipelineStage(card.stage)) return;
    if (target && !stageTransitionNeedsDialog(target)) {
      void moveCard(card, target, {}, "button").finally(() =>
        restoreFocus(card.applicationId),
      );
      return;
    }
    setDialog({ card, target, intent: "button" });
  };

  const openAssessment = (card: PipelineApplicationCard) => {
    assessmentReturnFocus.current =
      document.activeElement as HTMLElement | null;
    setAssessmentCard(card);
  };

  const closeAssessment = () => {
    const target = assessmentReturnFocus.current;
    assessmentReturnFocus.current = null;
    setAssessmentCard(null);
    window.setTimeout(() => target?.focus(), 0);
  };

  const renderColumn = (summary: PipelineStageCount) => {
    const column = state.columns[summary.stage];
    const page = visiblePage(summary.stage);
    return (
      <RecruitmentPipelineColumn
        key={summary.stage}
        jobId={jobId}
        summary={summary}
        page={page}
        loading={column?.loading ?? true}
        loadingMore={column?.loadingMore ?? false}
        error={column?.error ?? null}
        onLoadMore={state.loadMore}
        onRetry={(stage) => void state.loadStage(stage)}
        onChangeStage={requestStageChange}
        onViewAssessment={openAssessment}
        sortDirection={sortDirections[summary.stage]}
        sortMenuOpen={openSortMenu === summary.stage}
        onToggleSortMenu={(stage) =>
          setOpenSortMenu((current) => (current === stage ? null : stage))
        }
        onSortDirectionChange={(stage, direction) => {
          setSortDirections((current) => ({ ...current, [stage]: direction }));
          setOpenSortMenu(null);
        }}
        filterActive={filterActive}
        loadedItemCount={column?.page?.items.length ?? 0}
      />
    );
  };

  if (state.loading && !state.metadata) {
    return (
      <div className="pipeline-state" role="status">
        Loading recruitment pipeline...
      </div>
    );
  }
  if (state.error || !state.metadata) {
    return (
      <div className="pipeline-state" role="alert">
        <p>{state.error ?? "The recruitment pipeline is unavailable."}</p>
        <button type="button" onClick={() => void state.retry()}>
          Retry
        </button>
      </div>
    );
  }

  const boardMetadata = state.metadata;
  const total = boardMetadata.stages.reduce((sum, item) => sum + item.count, 0);
  return (
    <div
      className="recruitment-pipeline"
      aria-label={`Recruitment pipeline for ${boardMetadata.job.title}`}
    >
      <header className="recruitment-pipeline__header">
        <div>
          <h1>{boardMetadata.job.title} pipeline</h1>
          <p>
            {boardMetadata.job.status === "CLOSED"
              ? "Closed to new applications; recruitment decisions remain available."
              : `${total} applications across the pipeline.`}
          </p>
        </div>
        <div className="recruitment-pipeline__header-actions">
          <span className="sr-only">
            Read-only access:{" "}
            {boardMetadata.permissions.canMoveStages
              ? "No, stage controls are enabled."
              : "Yes."}
          </span>
          {!boardMetadata.permissions.canMoveStages ? (
            <strong>Read-only access</strong>
          ) : null}
          <button type="button" onClick={() => void state.retry()}>
            Refresh
          </button>
        </div>
      </header>
      <p className="sr-only" aria-live="polite">
        {state.announcement}
      </p>
      {state.canRetryStageMove ? (
        <button type="button" onClick={() => void state.retryStageMove()}>
          Retry stage change
        </button>
      ) : null}

      {/* Additions outside the original flow: local filter/search over loaded cards. */}
      <div
        className="pipeline-filter-bar"
        data-addition="outside-original-flow"
      >
        <label
          className="pipeline-search-field"
          htmlFor="pipeline-candidate-search"
        >
          <Search aria-hidden="true" />
          <span className="sr-only">Search candidates by name</span>
          <input
            id="pipeline-candidate-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search candidate names..."
          />
        </label>
        <div
          className="pipeline-tier-filters"
          role="group"
          aria-label="Filter candidates by final-score tier"
        >
          {tierOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                tierFilter === option.value
                  ? "pipeline-tier-filter is-active"
                  : "pipeline-tier-filter"
              }
              aria-pressed={tierFilter === option.value}
              onClick={() => setTierFilter(option.value)}
            >
              {option.value !== "all" ? (
                <span aria-hidden="true" />
              ) : (
                <SlidersHorizontal aria-hidden="true" />
              )}
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="pipeline-filter-status" role="status">
        {dateFilterLabel(tierFilter, searchQuery)}
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up application ${active.id}.`,
            onDragOver: ({ over }) =>
              over ? `Over ${over.id}.` : "Not over a stage.",
            onDragEnd: ({ over }) =>
              over ? `Dropped in ${over.id}.` : "Move cancelled.",
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className="recruitment-pipeline__sections">
          <div className="pipeline-section pipeline-section--active">
            <div className="pipeline-section__header">
              <div>
                <h2 id="active-pipeline-heading">Active pipeline</h2>
                <p>Applications moving through the hiring process.</p>
              </div>
            </div>
            <div className="recruitment-pipeline__columns">
              {activePipelineStages.map((stage) => {
                const summary = boardMetadata.stages.find(
                  (item) => item.stage === stage,
                );
                return summary ? renderColumn(summary) : null;
              })}
            </div>
          </div>
          <div className="pipeline-section pipeline-section--outcomes">
            <div className="pipeline-section__header">
              <div>
                <h2 id="pipeline-outcomes-heading">Outcomes</h2>
                <p>Closed or paused applications.</p>
              </div>
            </div>
            <div className="recruitment-pipeline__columns">
              {outcomeStages.map((stage) => {
                const summary = boardMetadata.stages.find(
                  (item) => item.stage === stage,
                );
                return summary ? renderColumn(summary) : null;
              })}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeCard ? (
            <RecruitmentPipelineCard
              card={activeCard}
              jobId={jobId}
              dragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      {dialog ? (
        <ApplicationStageChangeDialog
          card={dialog.card}
          initialTarget={dialog.target}
          onCancel={() => {
            const id = dialog.card.applicationId;
            setDialog(null);
            restoreFocus(id);
          }}
          onSubmit={(target, extras) => {
            const card = dialog.card;
            const intent = dialog.intent ?? "button";
            setDialog(null);
            void moveCard(card, target, extras, intent).finally(() =>
              restoreFocus(card.applicationId),
            );
          }}
        />
      ) : null}
      {assessmentCard ? (
        <CandidateScoreDrawer
          jobId={jobId}
          jobTitle={boardMetadata.job.title}
          candidate={assessmentCard}
          readOnly
          onClose={closeAssessment}
          onSetPriority={() => undefined}
          onShortlist={() => undefined}
          onMoveToInterview={() => undefined}
          onReject={() => undefined}
          onApplicationOpened={() => {
            void state.retry({ preserve: true });
          }}
          onOpenRecruitmentChat={async () => undefined}
          onScoringChanged={() => {
            void state.retry({ preserve: true });
          }}
        />
      ) : null}
    </div>
  );
}
