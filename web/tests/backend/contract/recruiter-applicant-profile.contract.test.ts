import { describe, expect, it } from "vitest";
import { recruiterCandidateProfileSchema } from "@/shared/contracts/recruiter-candidate-profile";

describe("recruiter applicant profile contract", () => {
  it("does not admit contact values in snapshot or live profile", () => {
    const parsed = recruiterCandidateProfileSchema.parse({
      submittedProfile: { candidateName: "Candidate", headline: null, summary: null, location: null, skills: [], experience: [], education: [] },
      liveProfile: null,
      contactShared: false,
      submittedProfileAvailable: true,
    });
    expect(parsed.contactShared).toBe(false);
    expect(() => recruiterCandidateProfileSchema.parse({ ...parsed, submittedProfile: { ...parsed.submittedProfile!, email: "private@example.com" } })).toThrow();
  });
});
