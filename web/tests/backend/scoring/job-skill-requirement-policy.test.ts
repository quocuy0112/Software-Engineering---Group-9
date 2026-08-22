import { describe, expect, it } from "vitest";
import {
  partitionJobSkillsForMatching,
  resolveMatchingSkillRequirements,
} from "@/backend/scoring/domain/job-skill-requirement-policy";

describe("job skill requirement policy", () => {
  it("promotes a legacy all-preferred skill list to required", () => {
    const skills = [
      { skillId: "typescript", displayName: "TypeScript", required: false },
      { skillId: "cpp", displayName: "C++", required: false },
      { skillId: "java", displayName: "Java", required: false },
    ];

    const result = partitionJobSkillsForMatching(skills);

    expect(result.requiredSkills.map((skill) => skill.displayName)).toEqual([
      "TypeScript",
      "C++",
      "Java",
    ]);
    expect(result.preferredSkills).toHaveLength(0);
  });

  it("preserves an explicit mixed required and preferred split", () => {
    const required = { skillId: "java", required: true };
    const preferred = { skillId: "docker", required: false };

    expect(partitionJobSkillsForMatching([required, preferred])).toEqual({
      requiredSkills: [required],
      preferredSkills: [preferred],
    });
  });

  it("repairs a legacy private-match snapshot before scoring", () => {
    const preferred = [
      { code: "typescript", label: "TypeScript" },
      { code: "cpp", label: "C++" },
      { code: "java", label: "Java" },
    ];

    expect(resolveMatchingSkillRequirements([], preferred)).toEqual({
      requiredSkills: preferred,
      preferredSkills: [],
    });
  });
});
