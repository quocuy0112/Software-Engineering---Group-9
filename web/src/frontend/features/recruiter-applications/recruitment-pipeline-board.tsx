"use client";

import { useMemo, useRef, useState } from "react";
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
import type { ApplicationStage, PipelineApplicationCard } from "@/shared/contracts/applications";
import { RecruitmentPipelineColumn } from "./recruitment-pipeline-column";
import { RecruitmentPipelineCard } from "./recruitment-pipeline-card";
import { ApplicationStageChangeDialog } from "./application-stage-change-dialog";
import { useRecruitmentPipeline } from "./use-recruitment-pipeline";

export function RecruitmentPipelineBoard({ jobId }: { jobId: string }) {
  const state = useRecruitmentPipeline(jobId);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const [activeCard, setActiveCard] = useState<PipelineApplicationCard | null>(null);
  const [dialog, setDialog] = useState<{ card: PipelineApplicationCard; target?: ApplicationStage } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const cards = useMemo(() => Object.values(state.columns).flatMap((column) => column?.page?.items ?? []), [state.columns]);
  const restoreFocus = (applicationId: string) => window.setTimeout(() => document.querySelector<HTMLElement>(`[data-application-id="${CSS.escape(applicationId)}"]`)?.focus(), 0);
  const onDragStart = (event: DragStartEvent) => { const card = cards.find((item) => item.applicationId === String(event.active.id)) ?? null; setActiveCard(card); returnFocus.current = document.activeElement as HTMLElement | null; };
  const onDragCancel = () => { setActiveCard(null); setTimeout(() => returnFocus.current?.focus(), 0); };
  const onDragEnd = (event: DragEndEvent) => { const card = activeCard; setActiveCard(null); const target = event.over?.data.current?.stage as ApplicationStage | undefined; if (!card || !target || target === card.stage || !card.allowedDestinations.includes(target)) { setTimeout(() => returnFocus.current?.focus(), 0); return; } setDialog({ card, target }); };
  if (state.loading && !state.metadata) return <div className="pipeline-state" role="status">Loading recruitment pipeline…</div>;
  if (state.error || !state.metadata) return <div className="pipeline-state" role="alert"><p>{state.error ?? "The recruitment pipeline is unavailable."}</p><button type="button" onClick={() => void state.retry()}>Retry</button></div>;
  const total = state.metadata.stages.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="recruitment-pipeline" aria-label={`Recruitment pipeline for ${state.metadata.job.title}`}>
      <header className="recruitment-pipeline__header"><div><h1>{state.metadata.job.title} pipeline</h1><p>{state.metadata.job.status === "CLOSED" ? "Closed to new applications; recruitment decisions remain available." : `${total} applications across the pipeline.`}</p></div>{!state.metadata.permissions.canMoveStages ? <strong>Read-only access</strong> : null}</header>
      <p className="sr-only" aria-live="polite">{state.announcement}</p>
      {state.canRetryStageMove ? <button type="button" onClick={() => void state.retryStageMove()}>Retry stage change</button> : null}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={onDragEnd} accessibility={{ announcements: { onDragStart: ({ active }) => `Picked up application ${active.id}.`, onDragOver: ({ over }) => over ? `Over ${over.id}.` : "Not over a stage.", onDragEnd: ({ over }) => over ? `Dropped in ${over.id}.` : "Move cancelled.", onDragCancel: () => "Move cancelled." } }}>
        <div className="recruitment-pipeline__columns">{state.metadata.stages.map((summary) => { const column = state.columns[summary.stage]; return <RecruitmentPipelineColumn key={summary.stage} jobId={jobId} summary={summary} page={column?.page ?? null} loading={column?.loading ?? true} loadingMore={column?.loadingMore ?? false} error={column?.error ?? null} onLoadMore={state.loadMore} onRetry={(stage) => void state.loadStage(stage)} onChangeStage={(card) => { returnFocus.current = document.activeElement as HTMLElement; setDialog({ card }); }} />; })}</div>
        <DragOverlay>{activeCard ? <RecruitmentPipelineCard card={activeCard} jobId={jobId} dragOverlay /> : null}</DragOverlay>
      </DndContext>
      {dialog ? <ApplicationStageChangeDialog card={dialog.card} initialTarget={dialog.target} onCancel={() => { const id = dialog.card.applicationId; setDialog(null); restoreFocus(id); }} onSubmit={(target, extras) => { const card = dialog.card; setDialog(null); void state.move(card, target, extras).finally(() => restoreFocus(card.applicationId)); }} /> : null}
    </div>
  );
}
