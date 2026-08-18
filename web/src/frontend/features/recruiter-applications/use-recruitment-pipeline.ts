"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  pipelineApplicationStages,
  pipelineBoardMetadataSchema,
  pipelineStagePageSchema,
  type ApplicationStage,
  type PipelineBoardMetadata,
  type PipelineStagePage,
  type PipelineApplicationCard,
  type StageTransitionCommand,
  stageTransitionOutcomeSchema,
} from "@/shared/contracts/applications";

type ColumnState = Readonly<{ page: PipelineStagePage | null; loading: boolean; loadingMore: boolean; error: string | null }>;
type StageMoveOperation = Readonly<{ card: PipelineApplicationCard; targetStage: ApplicationStage; extras: Omit<StageTransitionCommand, "targetStage" | "expectedStageVersion">; idempotencyKey: string }>;
const emptyColumn = (): ColumnState => ({ page: null, loading: false, loadingMore: false, error: null });

class StageMoveRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function useRecruitmentPipeline(jobId: string) {
  const csrfProof = useCsrfProof();
  const [metadata, setMetadata] = useState<PipelineBoardMetadata | null>(null);
  const [columns, setColumns] = useState<Partial<Record<ApplicationStage, ColumnState>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null);
  const [canRetryStageMove, setCanRetryStageMove] = useState(false);
  const generation = useRef(0);
  const retryOperation = useRef<StageMoveOperation | null>(null);

  const loadStage = useCallback(async (stage: ApplicationStage, cursor?: string) => {
    const currentGeneration = generation.current;
    setColumns((current) => ({ ...current, [stage]: { ...(current[stage] ?? emptyColumn()), loading: !cursor, loadingMore: Boolean(cursor), error: null } }));
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/pipeline/${stage}?${params}`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message ?? "Unable to load this pipeline stage.");
      const page = pipelineStagePageSchema.parse(json);
      if (generation.current !== currentGeneration) return;
      setColumns((current) => {
        const previous = current[stage]?.page;
        const items = cursor && previous ? [...previous.items, ...page.items] : page.items;
        const unique = [...new Map(items.map((item) => [item.applicationId, item])).values()];
        return { ...current, [stage]: { page: { ...page, items: unique }, loading: false, loadingMore: false, error: null } };
      });
    } catch (cause) {
      if (generation.current !== currentGeneration) return;
      setColumns((current) => ({ ...current, [stage]: { ...(current[stage] ?? emptyColumn()), loading: false, loadingMore: false, error: cause instanceof Error ? cause.message : "Unable to load this pipeline stage." } }));
    }
  }, [jobId]);

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setMetadata(null);
    setColumns({});
    setLoading(true);
    setError(null);
    setCanRetryStageMove(false);
    try {
      const response = await fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/pipeline`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message ?? "The recruitment pipeline is unavailable.");
      const next = pipelineBoardMetadataSchema.parse(json);
      if (generation.current !== currentGeneration) return;
      setMetadata(next);
      await Promise.all(pipelineApplicationStages.map((stage) => loadStage(stage)));
    } catch (cause) {
      if (generation.current !== currentGeneration) return;
      setMetadata(null);
      setColumns({});
      setError(cause instanceof Error ? cause.message : "The recruitment pipeline is unavailable.");
    } finally {
      if (generation.current === currentGeneration) setLoading(false);
    }
  }, [jobId, loadStage]);

  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  const submitStageMove = useCallback(async (operation: StageMoveOperation, optimistic: boolean) => {
    const { card, targetStage, extras, idempotencyKey } = operation;
    if (pendingApplicationId) return false;
    retryOperation.current = operation;
    setPendingApplicationId(card.applicationId);
    setAnnouncement(`Moving ${card.candidate.displayName} to ${targetStage.replaceAll("_", " ")}.`);
    if (optimistic) {
      setColumns((current) => {
        const source = current[card.stage];
        const target = current[targetStage];
        if (!source?.page || !target?.page) return current;
        const optimisticCard = { ...card, stage: targetStage };
        return {
          ...current,
          [card.stage]: { ...source, page: { ...source.page, items: source.page.items.filter((item) => item.applicationId !== card.applicationId) } },
          [targetStage]: { ...target, page: { ...target.page, items: [optimisticCard, ...target.page.items.filter((item) => item.applicationId !== card.applicationId)] } },
        };
      });
    }
    try {
      const response = await fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(card.applicationId)}/stage`, { method: "PATCH", headers: { "content-type": "application/json", "x-csrf-token": csrfProof, "idempotency-key": idempotencyKey }, body: JSON.stringify({ targetStage, expectedStageVersion: card.stageVersion, ...extras }) });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new StageMoveRequestError(json?.message ?? "The stage change was not saved.", response.status);
      stageTransitionOutcomeSchema.parse(json);
      setAnnouncement(`${card.candidate.displayName} moved successfully.`);
      retryOperation.current = null;
      setCanRetryStageMove(false);
      await Promise.all([loadStage(card.stage), loadStage(targetStage), load()]);
      return true;
    } catch (cause) {
      setAnnouncement(cause instanceof Error ? cause.message : "The stage change was not saved.");
      const commandCannotBeRetried =
        cause instanceof StageMoveRequestError &&
        [401, 403, 404, 409].includes(cause.status);
      await load();
      if (commandCannotBeRetried) retryOperation.current = null;
      setCanRetryStageMove(!commandCannotBeRetried);
      return false;
    } finally { setPendingApplicationId(null); }
  }, [csrfProof, jobId, load, loadStage, pendingApplicationId]);

  const move = useCallback(async (card: PipelineApplicationCard, targetStage: ApplicationStage, extras: Omit<StageTransitionCommand, "targetStage" | "expectedStageVersion"> = {}) => {
    if (!card.allowedDestinations.includes(targetStage) || pendingApplicationId) return false;
    setCanRetryStageMove(false);
    return submitStageMove({ card, targetStage, extras, idempotencyKey: crypto.randomUUID() }, true);
  }, [pendingApplicationId, submitStageMove]);

  const retryStageMove = useCallback(() => {
    const operation = retryOperation.current;
    return operation ? submitStageMove(operation, false) : Promise.resolve(false);
  }, [submitStageMove]);

  return {
    metadata,
    columns,
    loading,
    error,
    loadStage,
    loadMore: (stage: ApplicationStage) => {
      const cursor = columns[stage]?.page?.nextCursor;
      if (cursor) void loadStage(stage, cursor);
    },
    retry: load,
    move,
    announcement,
    pendingApplicationId,
    canRetryStageMove,
    retryStageMove,
  };
}
