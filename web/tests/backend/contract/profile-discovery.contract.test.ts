import { describe, expect, it } from "vitest";
import { profileLookupQuerySchema, profileLookupResponseSchema } from "@/shared/contracts/profile-discovery";

describe("profile discovery contract", () => {
  it("only accepts one bounded exact ID", () => {
    expect(profileLookupQuerySchema.parse({ userId: "candidate_123" })).toEqual({ userId: "candidate_123" });
    expect(() => profileLookupQuerySchema.parse({ userId: "", name: "candidate" })).toThrow();
  });

  it("permits a neutral result without leaking a hidden profile", () => {
    expect(profileLookupResponseSchema.parse({ result: null })).toEqual({ result: null });
  });
});
