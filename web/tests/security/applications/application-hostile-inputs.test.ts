import { describe, expect, it } from "vitest";
import { applicationListQuerySchema } from "@/shared/contracts/applications";

describe("submitted candidate hostile input boundaries", () => {
  it("rejects oversized or malformed cursors before repository access", () => {
    expect(() => applicationListQuerySchema.parse({ cursor: "x".repeat(513) })).toThrow();
    expect(() => applicationListQuerySchema.parse({ limit: "-1" })).toThrow();
  });
});
