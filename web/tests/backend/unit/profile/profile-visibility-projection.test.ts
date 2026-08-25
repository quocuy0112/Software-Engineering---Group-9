import { describe, expect, it } from "vitest";
import { projectVisibleProfile } from "@/backend/services/profile/profile-visibility-projection";
import type { CandidateProfileContract } from "@/shared/contracts/account/profile";

const profile: CandidateProfileContract = {
  revision: 1, empty: false,
  basics: { headline: "Engineer", summary: "Private-safe summary", phone: "+84123456789", location: "HCM" },
  skills: [{ id: "skill", label: "TypeScript" }],
  experience: [{ id: "exp", title: "Developer", company: "SmartHire", description: null, startDate: "2024-01-01", endDate: null, current: true }],
  education: [], socialLinks: [{ id: "link", url: "https://example.com" }],
  visibility: { discoverableByExactId: true, candidateSections: ["headline", "skills"], recruiterSections: ["summary"], version: 1 },
};

describe("projectVisibleProfile", () => {
  it("is an allowlist and never emits contact data", () => {
    const result = projectVisibleProfile({ userId: "candidate", displayName: "Candidate", image: "https://example.com/a.png", profile, audience: "candidate" });
    expect(result).toEqual({ userId: "candidate", displayName: "Candidate", image: null, sections: { headline: "Engineer", skills: ["TypeScript"] } });
    expect(JSON.stringify(result)).not.toContain("123456789");
  });
});
