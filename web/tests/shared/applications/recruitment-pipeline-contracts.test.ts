import { describe, expect, it } from "vitest";
import {
  pipelineApplicationCardSchema,
  pipelineApplicationStages,
  pipelineBoardMetadataSchema,
  pipelineMembershipRoleSchema,
  pipelinePermissionsSchema,
  pipelineProblemSchema,
  pipelineStageCountSchema,
  pipelineStageLabels,
  pipelineStagePageQuerySchema,
  pipelineStagePageSchema,
  stageConflictSchema,
  stageTransitionCommandSchema,
  stageTransitionOutcomeSchema,
} from "@/shared/contracts/applications";

const stages = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
  "WAITLISTED",
] as const;

const labels = [
  "Applied",
  "Viewed",
  "Shortlisted",
  "Interviewing",
  "Offered",
  "Hired",
  "Offer Declined",
  "Rejected",
  "Waitlisted",
] as const;

const card = {
  applicationId: "application-1",
  candidate: { displayName: "Nguyen Van A", avatarUrl: null },
  submittedAt: "2026-08-17T02:00:00.000Z",
  stage: "APPLIED" as const,
  stageVersion: 1,
  documents: { cvAvailable: true, coverLetterAvailable: false },
  score: null,
  allowedDestinations: ["VIEWED", "SHORTLISTED"] as const,
};

describe("recruitment pipeline contracts", () => {
  it("reuses exactly the nine canonical stages and labels", () => {
    expect(pipelineApplicationStages).toEqual(stages);
    expect(stages.map((stage) => pipelineStageLabels[stage])).toEqual(labels);
    expect(() => pipelineStageCountSchema.parse({ stage: "NEW", label: "New", count: 0 })).toThrow();
    expect(
      pipelineStageCountSchema.parse({
        stage: "OFFER_DECLINED",
        label: "Offer Declined",
        count: 0,
      }),
    ).toBeTruthy();
  });

  it("keeps role capabilities explicit and strict", () => {
    expect(pipelineMembershipRoleSchema.options).toEqual([
      "OWNER",
      "HR_MANAGER",
      "RECRUITER",
      "HIRING_MANAGER",
    ]);
    expect(
      pipelinePermissionsSchema.parse({
        role: "OWNER",
        canView: true,
        canMoveStages: false,
        canReject: false,
        canRecordOfferDeclined: false,
        canConfirmHired: false,
      }),
    ).toBeTruthy();
    expect(() =>
      pipelinePermissionsSchema.parse({
        role: "OWNER",
        canView: true,
        canMoveStages: false,
        canReject: false,
        canRecordOfferDeclined: false,
        canConfirmHired: false,
        serverAuthority: false,
      }),
    ).toThrow();
  });

  it("validates strict board, card, and bounded stage-page payloads", () => {
    const metadata = {
      job: { jobId: "catalogue-job-1", title: "Backend Engineer", status: "ACTIVE" as const },
      permissions: {
        role: "RECRUITER" as const,
        canView: true as const,
        canMoveStages: true,
        canReject: true,
        canRecordOfferDeclined: true,
        canConfirmHired: true,
      },
      stages: stages.map((stage) => ({ stage, label: pipelineStageLabels[stage], count: 0 })),
      observedAt: "2026-08-17T02:00:00.000Z",
    };
    expect(pipelineBoardMetadataSchema.parse(metadata)).toEqual(metadata);
    expect(pipelineApplicationCardSchema.parse(card)).toEqual(card);
    expect(
      pipelineStagePageSchema.parse({
        stage: "APPLIED",
        items: [card],
        nextCursor: null,
        observedAt: "2026-08-17T02:00:00.000Z",
      }),
    ).toBeTruthy();
    expect(pipelineStagePageQuerySchema.parse({}).limit).toBe(25);
    expect(pipelineStagePageQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(() => pipelineStagePageQuerySchema.parse({ limit: 101 })).toThrow();
    expect(() => pipelineApplicationCardSchema.parse({ ...card, privateNote: "hidden" })).toThrow();
  });

  it("keeps scoring optional and separate from stage state", () => {
    expect(pipelineApplicationCardSchema.parse(card).score).toBeNull();
    expect(
      pipelineApplicationCardSchema.parse({
        ...card,
        score: {
          state: "SCORED",
          final: 86,
          band: { code: "HIGH_MATCH", label: "Strong match" },
        },
      }).stage,
    ).toBe("APPLIED");
  });

  it("validates strict stage commands and authoritative outcomes", () => {
    expect(
      stageTransitionCommandSchema.parse({
        targetStage: "VIEWED",
        expectedStageVersion: 1,
      }),
    ).toBeTruthy();
    expect(() =>
      stageTransitionCommandSchema.parse({
        targetStage: "VIEWED",
        expectedStageVersion: 1,
        score: 100,
      }),
    ).toThrow();
    expect(
      stageTransitionOutcomeSchema.parse({
        applicationId: "application-1",
        fromStage: "APPLIED",
        stage: "VIEWED",
        stageVersion: 2,
        lastStageChangedAt: "2026-08-17T02:00:00.000Z",
        stageEventId: "event-1",
        replayed: false,
        allowedDestinations: ["SHORTLISTED"],
      }),
    ).toBeTruthy();
  });

  it("keeps general problems and stage conflicts closed", () => {
    expect(
      pipelineProblemSchema.parse({ code: "APPLICATION_UNAVAILABLE", message: "Unavailable" }),
    ).toBeTruthy();
    expect(
      stageConflictSchema.parse({
        code: "APPLICATION_STAGE_CONFLICT",
        message: "Application changed",
        current: { stage: "VIEWED", stageVersion: 2 },
      }),
    ).toBeTruthy();
    expect(
      stageConflictSchema.parse({
        code: "IDEMPOTENCY_CONFLICT",
        message: "Command key was reused",
      }),
    ).toBeTruthy();
    expect(() =>
      stageConflictSchema.parse({
        code: "APPLICATION_STAGE_CONFLICT",
        message: "Application changed",
        current: { stage: "VIEWED", stageVersion: 2, candidateName: "private" },
      }),
    ).toThrow();
    expect(() =>
      stageConflictSchema.parse({
        code: "VALIDATION_ERROR",
        message: "Wrong status family",
      }),
    ).toThrow();
  });
});
