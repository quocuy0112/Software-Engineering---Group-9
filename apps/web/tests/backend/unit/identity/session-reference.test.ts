import { describe, expect, it } from "vitest";
import { sessionReferenceSchema } from "@/shared/contracts/identity/session";

describe("sessionReferenceSchema", () => {
  it("accepts Better Auth UUID and 32-character opaque IDs", () => {
    expect(
      sessionReferenceSchema.safeParse("123e4567-e89b-12d3-a456-426614174000")
        .success,
    ).toBe(true);
    expect(
      sessionReferenceSchema.safeParse("0123456789abcdef0123456789ABCDEF")
        .success,
    ).toBe(true);
  });

  it.each([
    "",
    "short",
    "../owned-session-reference",
    "reference/with/slash/characters",
    "reference?with=query-characters",
    "reference%2Fwith-encoding",
  ])("rejects malformed or path-confusing reference %s", (reference) => {
    expect(sessionReferenceSchema.safeParse(reference).success).toBe(false);
  });
});
