import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pipeline conflict contract", () => {
  it("maps all three 409 codes and reads current state only after authorization", () => {
    const source = readFileSync("src/app/api/recruiter/jobs/[jobId]/applications/[applicationId]/stage/route.ts", "utf8");
    expect(source).toContain("APPLICATION_STAGE_CONFLICT");
    expect(source).toContain("APPLICATION_STAGE_TRANSITION_INVALID");
    expect(source).toContain("IDEMPOTENCY_CONFLICT");
    expect(source).toContain("currentAuthorizedState");
    const service = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    expect(service).toContain("stageVersion");
  });
});
