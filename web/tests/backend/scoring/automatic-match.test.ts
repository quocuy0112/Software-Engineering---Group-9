import { describe, expect, it } from "vitest";
import { calculateAutomaticMatch } from "@/backend/scoring/domain/automatic-match-calculator";

const base = {
  applicationId: "app-1",
  cvVersion: "CV-v1",
  jdVersion: "JD-v3",
  configVersion: "HS-60/40-v1",
  parserVersion: "parser-v2.4",
  cvParse: { code: "PARSED_SUCCESSFULLY" as const, label: "Parsed successfully" as const, parserVersion: "parser-v2.4", processingMilliseconds: 12, snapshotVersion: "CV-v1" },
  jdParse: { code: "PARSED_SUCCESSFULLY" as const, label: "Parsed successfully" as const, parserVersion: "parser-v2.4", processingMilliseconds: 12, snapshotVersion: "JD-v3" },
  requiredSkills: [{ code: "react", label: "React" }, { code: "typescript", label: "TypeScript" }],
  preferredSkills: [{ code: "docker", label: "Docker" }],
  minimumExperienceYears: 4,
};

describe("deterministic automatic matching", () => {
  it("is reproducible and keeps preferred skills neutral", () => {
    const input = { ...base, cvText: "React and TypeScript delivery for 5 years. Docker exposure." };
    const first = calculateAutomaticMatch(input);
    const second = calculateAutomaticMatch(input);
    expect(first.result).toEqual(second.result);
    expect(first.result.score).toBe(100);
    expect(first.preferredSkillBonus).toBe(0);
  });

  it("separates missing skills and does not infer unmentioned experience", () => {
    const result = calculateAutomaticMatch({ ...base, cvText: "Built React interfaces." }).result;
    expect(result.missingRequiredSkills.map((skill) => skill.skillCode)).toEqual(["typescript"]);
    expect(result.detectedExperience).toEqual({ kind: "NOT_DETECTED", label: "Not detected" });
    expect(result.score).toBe(37.5);
  });

  it("marks parser warnings without removing deterministic evidence", () => {
    const result = calculateAutomaticMatch({ ...base, cvText: "React for 4 years", cvParse: { ...base.cvParse, code: "PARSED_WITH_ERRORS", label: "Parsed with errors" } }).result;
    expect(result.mayBeIncomplete).toBe(true);
    expect(result.incompletenessLabel).toContain("parsing");
    expect(result.foundRequiredSkills[0]?.evidence[0]?.sectionLabel).toBe("CV body");
  });
});
