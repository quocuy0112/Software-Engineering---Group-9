import { describe, expect, it } from "vitest";
import { applicationSubmitCommandSchema } from "@/shared/contracts/candidate-applications";

describe("application contact consent contract", () => {
  it("accepts explicit contact sharing and remains compatible with older submits", () => {
    const base = { draftId: "draft", expectedRevision: 1, informationConfirmed: true as const };
    expect(applicationSubmitCommandSchema.parse({ ...base, shareContactWithRecruiter: true }).shareContactWithRecruiter).toBe(true);
    expect(applicationSubmitCommandSchema.parse(base).shareContactWithRecruiter).toBeUndefined();
  });
});
