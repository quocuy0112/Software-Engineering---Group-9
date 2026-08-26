import { describe, expect, it } from "vitest";
import { profileSectionMutationSchema, profileVisibilitySchema } from "@/shared/contracts/account/profile";

describe("candidate profile visibility contract", () => {
  it("defaults to an explicit, bounded audience policy shape", () => {
    expect(profileVisibilitySchema.parse({ discoverableByExactId: false, candidateSections: [], recruiterSections: [], version: 0 }).discoverableByExactId).toBe(false);
  });
  it("rejects unsupported fields and sections", () => {
    expect(() => profileSectionMutationSchema.parse({ section: "visibility", baseRevision: 0, visibility: { discoverableByExactId: true, candidateSections: ["phone"], recruiterSections: [] } })).toThrow();
  });
});
