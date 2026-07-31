import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  candidateProfileSchema,
  profileMutationOutcomeSchema,
  profileSectionMutationSchema,
  skillSuggestionsQuerySchema,
  skillSuggestionsResponseSchema,
} from "@/shared/contracts/account/profile";
import {
  GET as getProfile,
  PATCH as patchProfile,
} from "@/app/api/account/profile/route";
import { GET as suggestSkills } from "@/app/api/account/profile/skills/suggestions/route";

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};

describe("candidate profile contract", () => {
  it("parses the canonical empty aggregate and rejects extra ownership fields", () => {
    expect(candidateProfileSchema.parse(emptyProfile)).toEqual(emptyProfile);
    expect(
      candidateProfileSchema.safeParse({ ...emptyProfile, userId: "forged" })
        .success,
    ).toBe(false);
    expect(
      profileSectionMutationSchema.safeParse({
        section: "basics",
        baseRevision: 0,
        profileId: "forged",
        basics: emptyProfile.basics,
      }).success,
    ).toBe(false);
  });

  it("uses a strict discriminated section body and enforces collection caps", () => {
    expect(
      profileSectionMutationSchema.parse({
        section: "basics",
        baseRevision: 0,
        basics: emptyProfile.basics,
      }),
    ).toMatchObject({ section: "basics", baseRevision: 0 });
    expect(
      profileSectionMutationSchema.safeParse({
        section: "skills",
        baseRevision: 0,
        skills: Array.from({ length: 51 }, (_, index) => ({
          label: `Skill ${index}`,
        })),
      }).success,
    ).toBe(false);
    expect(
      profileSectionMutationSchema.safeParse({
        section: "socialLinks",
        baseRevision: 0,
        socialLinks: Array.from({ length: 11 }, (_, index) => ({
          url: `https://example.test/${index}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("requires conflictApplied and exposes only catalog skill fields", () => {
    expect(
      profileMutationOutcomeSchema.safeParse({
        profile: emptyProfile,
        warnings: [],
        message: "Saved.",
      }).success,
    ).toBe(false);
    expect(
      profileMutationOutcomeSchema.parse({
        profile: emptyProfile,
        conflictApplied: true,
        warnings: [],
        message: "Saved over a newer revision.",
      }).conflictApplied,
    ).toBe(true);
    expect(
      skillSuggestionsQuerySchema.parse({ query: "type", limit: "20" }),
    ).toEqual({ query: "type", limit: 20 });
    expect(
      skillSuggestionsResponseSchema.safeParse({
        skills: [{ id: "skill-1", label: "TypeScript", usageCount: 10 }],
      }).success,
    ).toBe(false);
  });

  it("keeps OpenAPI profile operations aligned with strict local references", () => {
    const openapi = readFileSync(
      resolve(
        process.cwd(),
        "../spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml",
      ),
      "utf8",
    );
    expect(openapi).toContain("/api/account/profile:");
    expect(openapi).toContain("operationId: getOwnCandidateProfile");
    expect(openapi).toContain("operationId: saveOwnCandidateProfileSection");
    expect(openapi).toContain("operationId: suggestSkills");
    expect(openapi).toContain('$ref: "#/components/headers/NoStoreHeader"');
    expect(openapi).toContain(
      "required: [profile, conflictApplied, warnings, message]",
    );
  });

  it("returns no-store for unauthenticated Profile GET and PATCH", async () => {
    const getResponse = await getProfile(
      new Request("http://localhost:3001/api/account/profile"),
    );
    const patchResponse = await patchProfile(
      new Request("http://localhost:3001/api/account/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: "basics",
          baseRevision: 0,
          basics: emptyProfile.basics,
        }),
      }),
    );
    expect(getResponse.status).toBe(401);
    expect(patchResponse.status).toBe(401);
    expect(getResponse.headers.get("cache-control")).toContain("no-store");
    expect(patchResponse.headers.get("cache-control")).toContain("no-store");
  });

  it("requires authentication for catalog-only skill suggestions", async () => {
    const response = await suggestSkills(
      new Request(
        "http://localhost:3001/api/account/profile/skills/suggestions?query=type",
      ),
    );
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toMatch(
      /usage|userId|profileId/i,
    );
  });
});
