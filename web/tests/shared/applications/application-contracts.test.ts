import { describe, expect, it } from "vitest";
import {
  applicationListQuerySchema,
  applicationPageSchema,
  submittedCandidateSchema,
} from "@/shared/contracts/applications";
import { applicationPageFixture, submittedCandidateFixture } from "../../helpers/application-fixture";

describe("submitted candidate contracts", () => {
  it("accepts a document-complete candidate without score fields", () => {
    const candidate = submittedCandidateFixture();
    expect(submittedCandidateSchema.parse(candidate)).toEqual(candidate);
    expect(candidate).not.toHaveProperty("score");
    expect(candidate).not.toHaveProperty("aiMatchScore");
    expect(candidate).not.toHaveProperty("rank");
  });

  it("preserves explicit absent cover-letter semantics", () => {
    const candidate = submittedCandidateFixture({ coverLetter: { kind: "NONE" } });
    expect(submittedCandidateSchema.parse(candidate).coverLetter).toEqual({ kind: "NONE" });
  });

  it("bounds list requests and page payloads", () => {
    expect(applicationListQuerySchema.parse({}).limit).toBe(25);
    expect(applicationListQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(() => applicationListQuerySchema.parse({ limit: 101 })).toThrow();
    expect(applicationPageSchema.parse(applicationPageFixture())).toBeTruthy();
  });
});
