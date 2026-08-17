import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  pipelineApplicationCardSchema,
  pipelineBoardMetadataSchema,
  pipelineStagePageSchema,
  stageConflictSchema,
  stageTransitionCommandSchema,
  stageTransitionOutcomeSchema,
} from "@/shared/contracts/applications";

const openapi = readFileSync(
  "../spec-kit/specs/019-recruitment-pipeline-kanban-board/contracts/recruitment-pipeline.openapi.yaml",
  "utf8",
);

describe("recruitment pipeline OpenAPI and runtime parity", () => {
  it("documents the three reviewed job-scoped operations", () => {
    for (const operation of [
      "getRecruitmentPipelineBoard",
      "getRecruitmentPipelineStage",
      "transitionRecruitmentPipelineStage",
    ]) {
      expect(openapi).toContain(`operationId: ${operation}`);
    }
    expect(openapi).toContain("name: Idempotency-Key");
    expect(openapi).toContain("name: X-CSRF-Token");
    expect(openapi).toContain("maximum: 100");
    expect(openapi).toContain("default: 25");
  });

  it("keeps every runtime response and command schema strict", () => {
    for (const schema of [
      pipelineBoardMetadataSchema,
      pipelineStagePageSchema,
      pipelineApplicationCardSchema,
      stageTransitionCommandSchema,
      stageTransitionOutcomeSchema,
      stageConflictSchema,
    ]) {
      expect(schema.safeParse({ unsupported: true }).success).toBe(false);
    }
  });

  it("keeps StageConflict closed without incompatible Problem composition", () => {
    const match = openapi.match(/ {4}StageConflict:\r?\n([\s\S]*?)(?=\n {2}responses:)/);
    expect(match?.[1]).toBeTruthy();
    expect(match?.[1]).toContain("additionalProperties: false");
    expect(match?.[1]).toContain("required: [code, message]");
    expect(match?.[1]).not.toContain("allOf:");
    expect(match?.[1]).not.toContain("#/components/schemas/Problem");
    expect(match?.[1]).toContain("APPLICATION_STAGE_CONFLICT");
    expect(match?.[1]).toContain("APPLICATION_STAGE_TRANSITION_INVALID");
    expect(match?.[1]).toContain("IDEMPOTENCY_CONFLICT");
    expect(match?.[1]).toContain(
      "Current state is present only after application authorization succeeds.",
    );
  });
});
