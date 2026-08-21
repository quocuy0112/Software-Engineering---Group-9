import { describe, expect, it } from "vitest";
import {
  hasCandidateJobSignals,
  rankJobsForCandidate,
} from "@/backend/services/jobs/candidate-job-match";
import {
  candidateProfile,
  insufficientCandidateProfile,
} from "../../../helpers/home/home-fixtures";

describe("candidate-facing deterministic job recommendation", () => {
  const jobs = [
    {
      id: "matching",
      status: "open",
      skillTags: ["TypeScript", "React"],
      city: "Hà Nội",
      experienceMinYears: 0,
      postedAt: "2026-08-12T00:00:00.000Z",
    },
    {
      id: "other",
      status: "open",
      skillTags: ["Java"],
      city: "Đà Nẵng",
      experienceMinYears: 5,
      postedAt: "2026-08-11T00:00:00.000Z",
    },
  ];
  it("requires a non-empty profile with a job signal", () => {
    expect(hasCandidateJobSignals(candidateProfile())).toBe(true);
    expect(hasCandidateJobSignals(insufficientCandidateProfile())).toBe(false);
  });
  it("keeps deterministic order and explainable skills", () => {
    const ranked = rankJobsForCandidate(candidateProfile(), jobs);
    expect(ranked[0]?.candidate.id).toBe("matching");
    expect(ranked[0]?.matchingSkills).toEqual(["TypeScript"]);
    expect(ranked[0]?.improvementAreas).toEqual(["React"]);
    expect(ranked[0]?.matchScore).toBeGreaterThan(ranked[1]?.matchScore ?? 0);
  });

  it("returns actual score contributions instead of normalised profile signals", () => {
    const [match] = rankJobsForCandidate(candidateProfile(), [jobs[0]!]);

    expect(match?.matchBreakdown).toEqual({
      roleAndSkills: 13,
      preferences: 15,
      experience: 0,
      unmatched: 72,
    });
    expect(
      Object.values(match?.matchBreakdown ?? {}).reduce(
        (total, value) => total + value,
        0,
      ),
    ).toBe(100);
    expect(match?.matchScore).toBe(28);
  });
});
