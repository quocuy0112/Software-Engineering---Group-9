import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canTransitionApplicationStage, ordinaryApplicationTransitions } from "@/backend/services/jobs/application-stage-policy";
import { pipelineApplicationStages } from "@/shared/contracts/applications";

describe("single application stage authority", () => {
  it("keeps the complete canonical transition matrix at the authority boundary", () => {
    for (const from of pipelineApplicationStages) for (const to of pipelineApplicationStages) expect(ordinaryApplicationTransitions[from].includes(to)).toBe(canTransitionApplicationStage(from, to));
  });

  it("uses canonical authorization, serializable compare-and-set, history, audit, and score isolation", () => {
    const source = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    expect(source).toContain("RecruiterApplicationAuthorization");
    expect(source).toContain("canMoveStages");
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain("stageVersion: command.expectedStageVersion");
    expect(source).toContain("applicationStageEvent.create");
    expect(source).toContain("PrismaAuditRepository");
    expect(source).not.toMatch(/data:\s*\{[^}]*scoringStatus/u);
  });
});
