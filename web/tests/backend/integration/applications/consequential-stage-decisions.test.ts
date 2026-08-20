import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rejectionReasonCodeSchema } from "@/shared/contracts/applications";

describe("consequential stage decisions", () => {
  it("uses the six current rejection reasons and bounded private notes", () => {
    expect(rejectionReasonCodeSchema.options).toHaveLength(6);
    const contract = readFileSync("src/shared/contracts/applications/recruitment-pipeline.ts", "utf8");
    expect(contract).toContain("max(2_000)");
  });
  it("requires confirmation and reasons in the single stage authority", () => {
    const source = readFileSync("src/backend/services/jobs/application-stage-service.ts", "utf8");
    expect(source).toContain("APPLICATION_STAGE_CONFIRMATION_REQUIRED");
    expect(source).toContain("APPLICATION_STAGE_REASON_REQUIRED");
    expect(source).toContain("rejectionReasonCodeSchema.safeParse");
    expect(source).not.toMatch(/accept(?:ed|ance).*(?:HIRED|targetStage)/iu);
  });
});
