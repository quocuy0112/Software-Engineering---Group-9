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
import { RefreshCw, Search } from "lucide-react";
import type {
  ApplicationStage,
  PipelineBoardColumnStage,
  PipelineApplicationCard,
  PipelineColumnSummary,
  StageTransitionCommand,
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
import {
  RecruitmentPipelineViewAllModal,
  type ViewAllPipelineStage,
} from "./recruitment-pipeline-view-all-modal";

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

const viewAllStages = new Set<PipelineBoardColumnStage>([
  ...activePipelineStages,
  ...outcomeStages,
  "WITHDRAWN",
]);

function isViewAllPipelineStage(
  stage: PipelineBoardColumnStage,
): stage is ViewAllPipelineStage {
  return viewAllStages.has(stage);
}

const tierOptions: Array<{ value: PipelineTierFilter; label: string }> = [
  { value: "all", label: "All" },
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
  const [viewAllStage, setViewAllStage] = useState<ViewAllPipelineStage | null>(
    null,
  );
  const [bulkRejectCards, setBulkRejectCards] = useState<
    readonly PipelineApplicationCard[] | null
  >(null);
  const [bulkRejectBusy, setBulkRejectBusy] = useState(false);
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

  const visiblePage = (stage: PipelineBoardColumnStage) => {
    const column = state.columns[stage];
    if (!column?.page) return null;
    const filtered = filterPipelineCards(
      column.page.items,
      tierFilter,
      searchQuery,
    );
    return {
      ...column.page,
      items: sortPipelineCards(
        filtered,
        stage === "WITHDRAWN" ? "none" : sortDirections[stage],
      ),
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
    setActiveCard(
      card &&
        !isTerminalPipelineStage(card.stage) &&
        card.withdrawalOutcome !== "CANDIDATE_WITHDRAWN"
        ? card
        : null,
    );
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
      | PipelineBoardColumnStage
      | undefined;
    const dragDestinations = card?.dragDestinations ?? [];
    if (
      !card ||
      isTerminalPipelineStage(card.stage) ||
      card.withdrawalOutcome === "CANDIDATE_WITHDRAWN" ||
      !target ||
      target === "WITHDRAWN" ||
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
    if (
      isTerminalPipelineStage(card.stage) ||
      card.withdrawalOutcome === "CANDIDATE_WITHDRAWN"
    )
      return;
    if (target && !stageTransitionNeedsDialog(target)) {
      void moveCard(card, target, {}, "button").finally(() =>
        restoreFocus(card.applicationId),
      );
      return;
    }
    setDialog({ card, target, intent: "button" });
  };

  const runBulkMove = async (
    selectedCards: readonly PipelineApplicationCard[],
    targetStage: ApplicationStage,
    extras: Omit<
      StageTransitionCommand,
      "targetStage" | "expectedStageVersion"
    > = {},
  ) => {
    await state.moveMany(selectedCards, targetStage, extras);
    await state.retry();
    setViewAllStage(null);
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

  const renderColumn = (summary: PipelineColumnSummary) => {
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
        onViewAll={(stage) => {
          if (isViewAllPipelineStage(stage)) setViewAllStage(stage);
        }}
        showViewAll={isViewAllPipelineStage(summary.stage)}
        onChangeStage={requestStageChange}
        onViewAssessment={openAssessment}
        sortDirection={
          summary.stage === "WITHDRAWN" ? "none" : sortDirections[summary.stage]
        }
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
  const withdrawnSummary: PipelineColumnSummary = {
    stage: "WITHDRAWN",
    label: "Withdrawn",
    count: boardMetadata.withdrawnCount ?? 0,
  };
  const summaryForStage = (stage: ViewAllPipelineStage) =>
    stage === "WITHDRAWN"
      ? withdrawnSummary
      : boardMetadata.stages.find((item) => item.stage === stage);
  const total =
    boardMetadata.stages.reduce((sum, item) => sum + item.count, 0) +
    withdrawnSummary.count;
  return (
    <div
      className="recruitment-pipeline"
      aria-label={`Recruitment pipeline for ${boardMetadata.job.title}`}
    >
      <header className="page-header recruitment-pipeline__header">
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
          <button
            type="button"
            className="btn-refresh"
            onClick={() => void state.retry()}
          >
            <RefreshCw aria-hidden="true" />
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
        className="filter-bar pipeline-filter-bar"
        data-addition="outside-original-flow"
      >
        <label
          className="search-input pipeline-search-field"
          htmlFor="pipeline-candidate-search"
        >
          <Search aria-hidden="true" />
          <span className="sr-only">Search candidates by name</span>
          <input
            id="pipeline-candidate-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={"Search by candidate name..."}
          />
        </label>
        <div
          className="filter-pills pipeline-tier-filters"
          role="group"
          aria-label="Filter candidates by final-score tier"
        >
          {tierOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                tierFilter === option.value
                  ? "pill pipeline-tier-filter active is-active"
                  : "pill pipeline-tier-filter"
              }
              data-filter={option.value}
              aria-pressed={tierFilter === option.value}
              onClick={() => setTierFilter(option.value)}
            >
              {option.value !== "all" ? (
                <span className="dot" aria-hidden="true" />
              ) : null}
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
          <section className="pipeline-section pipeline-section--active">
            <div className="section-head pipeline-section__header">
              <h2 id="active-pipeline-heading">Active pipeline</h2>
              <span>Applications moving through the hiring process.</span>
            </div>
            <div className="board recruitment-pipeline__columns">
              {activePipelineStages.map((stage) => {
                const summary = boardMetadata.stages.find(
                  (item) => item.stage === stage,
                );
                return summary ? renderColumn(summary) : null;
              })}
            </div>
          </section>
          <hr className="section-divider" />
          <section className="pipeline-section pipeline-section--outcomes">
            <div className="section-head pipeline-section__header">
              <h2 id="pipeline-outcomes-heading">Outcomes</h2>
              <span>Closed or paused applications.</span>
            </div>
            <div className="board outcomes recruitment-pipeline__columns">
              {outcomeStages.map((stage) => {
                const summary = boardMetadata.stages.find(
                  (item) => item.stage === stage,
                );
                return summary ? renderColumn(summary) : null;
              })}
              {renderColumn(withdrawnSummary)}
            </div>
          </section>
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
          fixedTarget={
            dialog.intent === "drag" &&
            dialog.target &&
            !dialog.card.allowedDestinations.includes(dialog.target)
              ? dialog.target
              : undefined
          }
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
      {viewAllStage
        ? (() => {
            const summary = summaryForStage(viewAllStage);
            return summary ? (
              <RecruitmentPipelineViewAllModal
                jobId={jobId}
                summary={summary}
                canMoveStages={boardMetadata.permissions.canMoveStages}
                canReject={boardMetadata.permissions.canReject}
                onClose={() => setViewAllStage(null)}
                onBulkMove={runBulkMove}
                onBulkReject={(cards) => {
                  setBulkRejectBusy(false);
                  setBulkRejectCards(cards);
                }}
              />
            ) : null;
          })()
        : null}
      {bulkRejectCards ? (
        <ApplicationStageChangeDialog
          card={bulkRejectCards[0]}
          initialTarget="REJECTED"
          fixedTarget="REJECTED"
          title={"Reject " + bulkRejectCards.length + " candidates?"}
          description="Choose one required rejection reason for every selected candidate."
          busy={bulkRejectBusy}
          onCancel={() => {
            if (!bulkRejectBusy) {
              setBulkRejectBusy(false);
              setBulkRejectCards(null);
            }
          }}
          onSubmit={(target, extras) => {
            const cards = bulkRejectCards;
            setBulkRejectBusy(true);
            void runBulkMove(cards, target, extras).then(() => {
              setBulkRejectBusy(false);
              setBulkRejectCards(null);
            });
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
