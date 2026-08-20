import { describe, expect, it } from "vitest";
import { applicationStageCommandDigest } from "@/backend/services/jobs/application-stage-service";

const command = { targetStage: "VIEWED", expectedStageVersion: 1, confirmed: false, reasonCode: null, candidateVisibleReason: null, internalNote: null } as const;
const base = { actorUserId: "actor-1", requestedJobId: "catalogue-1", canonicalJobId: "job-1", applicationId: "app-1", command, source: "KANBAN" };

describe("stage command identity", () => {
  it("is stable for an exact normalized retry", () => expect(applicationStageCommandDigest(base)).toBe(applicationStageCommandDigest({ ...base, command: { ...command } })));
  it.each([
    ["actor", { actorUserId: "actor-2" }], ["requested job", { requestedJobId: "catalogue-2" }], ["canonical job", { canonicalJobId: "job-2" }], ["application", { applicationId: "app-2" }], ["target", { command: { ...command, targetStage: "SHORTLISTED" as const } }], ["version", { command: { ...command, expectedStageVersion: 2 } }], ["reason", { command: { ...command, reasonCode: "POSITION_FILLED" } }], ["note", { command: { ...command, internalNote: "private" } }], ["confirmation", { command: { ...command, confirmed: true } }], ["source", { source: "INTERVIEW_ADAPTER" }],
  ])("changes when bound %s changes", (_label, change) => expect(applicationStageCommandDigest({ ...base, ...change } as never)).not.toBe(applicationStageCommandDigest(base)));
});
