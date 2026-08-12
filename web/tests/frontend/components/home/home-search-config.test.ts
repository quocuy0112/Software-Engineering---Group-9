import { describe, expect, it } from "vitest";
import { buildHomeJobSearch, emptyHomeSearchDraft } from "@/frontend/features/home/home-search-config";

describe("Home search handoff", () => {
  it("serializes only the approved six criteria", () => {
    const params = buildHomeJobSearch({ ...emptyHomeSearchDraft, keyword: "  frontend ", location: "Hà Nội", workArrangement: "HYBRID", employmentType: "INTERNSHIP", experienceLevel: "ENTRY", skills: "React, TypeScript, React" });
    expect([...params.keys()]).toEqual(["q", "location", "workArrangement", "employmentType", "experienceLevel", "skills", "skills"]);
    expect(params.getAll("skills")).toEqual(["React", "TypeScript"]);
    expect(params.has("role")).toBe(false);
  });
  it("rejects unknown enum values and oversized skills", () => {
    expect(() => buildHomeJobSearch({ ...emptyHomeSearchDraft, workArrangement: "PRIVATE" })).toThrow();
    expect(() => buildHomeJobSearch({ ...emptyHomeSearchDraft, skills: "x".repeat(81) })).toThrow();
  });
});
