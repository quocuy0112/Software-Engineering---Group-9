import { describe, expect, it } from "vitest";
import { buildParticipantSearchFilter } from "@/backend/messaging/search/participant-search";

describe("eligible participant search classifier", () => {
  it("matches account IDs and emails exactly", () => {
    expect(
      buildParticipantSearchFilter("8fc8b912-baad-4be8-8c49-f8f9323f6255"),
    ).toEqual({ id: "8fc8b912-baad-4be8-8c49-f8f9323f6255" });
    expect(buildParticipantSearchFilter(" Person@Example.COM ")).toEqual({
      normalizedEmail: "person@example.com",
    });
  });

  it("uses case-insensitive contains only for names", () => {
    expect(buildParticipantSearchFilter(" Nguyễn An ")).toEqual({
      name: { contains: "Nguyễn An", mode: "insensitive" },
    });
    expect(buildParticipantSearchFilter(undefined)).toEqual({});
  });
});
