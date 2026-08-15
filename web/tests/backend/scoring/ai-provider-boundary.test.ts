import { describe, expect, it } from "vitest";
import { ApprovedAiAssessmentAdapter } from "@/backend/scoring/providers/approved-ai-assessment-adapter";
import { aiFixture } from "./fixtures";

const input = { applicationId: "app-1", cvVersion: "CV-v1", jdVersion: "JD-v3", configVersion: "HS-60/40-v1", automaticScore: 92, evidence: [{ title: "React", excerpt: "Built React applications." }] };

describe("approved AI provider boundary", () => {
  it("accepts only schema-valid provider output", async () => {
    await expect(new ApprovedAiAssessmentAdapter(async () => aiFixture()).assess(input)).resolves.toMatchObject({ score: 88, compliance: { code: "SENSITIVE_ATTRIBUTES_EXCLUDED" } });
  });

  it("normalizes malformed output to a safe provider error", async () => {
    await expect(new ApprovedAiAssessmentAdapter(async () => ({ score: 88 })).assess(input)).rejects.toMatchObject({ code: "AI_PROVIDER_MALFORMED" });
  });

  it("redacts contact data before the provider boundary", async () => {
    let received = "";
    const adapter = new ApprovedAiAssessmentAdapter(async (payload) => {
      received = payload.evidence[0]?.excerpt ?? "";
      return aiFixture();
    });
    await adapter.assess({ ...input, evidence: [{ title: "Evidence", excerpt: "Email jane@example.com or call +1 555 123 4567." }] });
    expect(received).not.toContain("jane@example.com");
    expect(received).not.toContain("555 123 4567");
  });
});
