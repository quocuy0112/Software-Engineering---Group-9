"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  isTerminalPipelineStage,
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
type StageMoveExtras = Omit<StageTransitionCommand, "targetStage" | "expectedStageVersion">;
type StageMoveOperation = Readonly<{ card: PipelineApplicationCard; targetStage: ApplicationStage; extras: StageMoveExtras; idempotencyKey: string }>;
type LoadStageOptions = Readonly<{ background?: boolean }>;
type PipelineLoadOptions = Readonly<{ preserve?: boolean }>;
const emptyColumn = (): ColumnState => ({ page: null, loading: false, loadingMore: false, error: null });
const pipelineRefreshIntervalMs = 2_000;

function pipelineMetadataChanged(current: PipelineBoardMetadata, next: PipelineBoardMetadata) {
  if (
    current.job.jobId !== next.job.jobId ||
    current.job.title !== next.job.title ||
    current.job.status !== next.job.status ||
    current.permissions.role !== next.permissions.role ||
    current.permissions.canMoveStages !== next.permissions.canMoveStages ||
    current.permissions.canReject !== next.permissions.canReject ||
    current.permissions.canRecordOfferDeclined !== next.permissions.canRecordOfferDeclined ||
    current.permissions.canConfirmHired !== next.permissions.canConfirmHired ||
    current.revisionAt !== next.revisionAt
  ) {
    return true;
  }

  const currentCounts = new Map(current.stages.map((stage) => [stage.stage, stage.count]));
  return next.stages.some((stage) => currentCounts.get(stage.stage) !== stage.count);
}

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
  const pendingApplicationIdRef = useRef<string | null>(null);
  const metadataRef = useRef<PipelineBoardMetadata | null>(null);
  const loadingRef = useRef(true);
  const pipelineRefreshInFlight = useRef(false);

  const loadStage = useCallback(async (stage: ApplicationStage, cursor?: string, options: LoadStageOptions = {}) => {
    const currentGeneration = generation.current;
    const background = options.background === true;
    setColumns((current) => ({ ...current, [stage]: { ...(current[stage] ?? emptyColumn()), loading: background ? (current[stage]?.loading ?? false) : !cursor, loadingMore: background ? (current[stage]?.loadingMore ?? false) : Boolean(cursor), error: null } }));
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

  const load = useCallback(async (options: PipelineLoadOptions = {}) => {
    const preserve = options.preserve === true;
    const currentGeneration = ++generation.current;
    loadingRef.current = true;
    if (!preserve) {
      metadataRef.current = null;
      setMetadata(null);
      setColumns({});
      setLoading(true);
    }
    setError(null);
    setCanRetryStageMove(false);
    try {
      const response = await fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/pipeline`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message ?? "The recruitment pipeline is unavailable.");
      const next = pipelineBoardMetadataSchema.parse(json);
      if (generation.current !== currentGeneration) return;
      metadataRef.current = next;
      setMetadata(next);
      await Promise.all(pipelineApplicationStages.map((stage) => loadStage(stage, undefined, { background: preserve })));
    } catch (cause) {
      if (generation.current !== currentGeneration) return;
      if (!preserve) {
        metadataRef.current = null;
        setMetadata(null);
        setColumns({});
        setError(cause instanceof Error ? cause.message : "The recruitment pipeline is unavailable.");
      }
    } finally {
      if (generation.current === currentGeneration) {
        loadingRef.current = false;
        if (!preserve) setLoading(false);
      }
    }
  }, [jobId, loadStage]);

  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  const pollMetadata = useCallback(async () => {
    if (
      pipelineRefreshInFlight.current ||
      loadingRef.current ||
      !metadataRef.current ||
      (typeof document !== "undefined" && document.visibilityState !== "visible")
    ) {
      return;
    }

    pipelineRefreshInFlight.current = true;
    try {
      const response = await fetch(`/api/recruiter/jobs/${encodeURIComponent(jobId)}/applications/pipeline`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) await load();
        return;
      }
      const next = pipelineBoardMetadataSchema.parse(json);
      const current = metadataRef.current;
      if (current && pipelineMetadataChanged(current, next)) await load({ preserve: true });
    } catch {
      // Keep the last usable board during transient polling failures.
    } finally {
      pipelineRefreshInFlight.current = false;
    }
  }, [jobId, load]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void pollMetadata(); };
    const interval = window.setInterval(refreshWhenVisible, pipelineRefreshIntervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pollMetadata]);

  const submitStageMove = useCallback(async (operation: StageMoveOperation, optimistic: boolean) => {
    const { card, targetStage, extras, idempotencyKey } = operation;
    if (pendingApplicationIdRef.current) return false;
    retryOperation.current = operation;
    pendingApplicationIdRef.current = card.applicationId;
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
    } finally {
      pendingApplicationIdRef.current = null;
      setPendingApplicationId(null);
    }
  }, [csrfProof, jobId, load, loadStage]);

  const move = useCallback(async (card: PipelineApplicationCard, targetStage: ApplicationStage, extras: StageMoveExtras = {}) => {
    if (isTerminalPipelineStage(card.stage) || !card.allowedDestinations.includes(targetStage) || pendingApplicationIdRef.current) return false;
    setCanRetryStageMove(false);
    return submitStageMove({ card, targetStage, extras, idempotencyKey: crypto.randomUUID() }, true);
  }, [submitStageMove]);

  const moveDrag = useCallback(async (card: PipelineApplicationCard, targetStage: ApplicationStage, extras: StageMoveExtras = {}) => {
    const dragDestinations = card.dragDestinations ?? [];
    if (isTerminalPipelineStage(card.stage) || !dragDestinations.includes(targetStage)) return false;
    return move(card, targetStage, { ...extras, intent: "drag" });
  }, [move]);

  const moveMany = useCallback(async (
    cardsToMove: readonly PipelineApplicationCard[],
    targetStage: ApplicationStage,
    extras: StageMoveExtras = {},
  ) => {
    let allSucceeded = true;
    for (const card of cardsToMove) {
      if (isTerminalPipelineStage(card.stage)) {
        allSucceeded = false;
        continue;
      }
      const succeeded = await submitStageMove(
        {
          card,
          targetStage,
          extras,
          idempotencyKey: crypto.randomUUID(),
        },
        true,
      );
      if (!succeeded) allSucceeded = false;
    }
    return allSucceeded;
  }, [submitStageMove]);

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
    moveDrag,
    moveMany,
    announcement,
    pendingApplicationId,
    canRetryStageMove,
    retryStageMove,
  };
}
