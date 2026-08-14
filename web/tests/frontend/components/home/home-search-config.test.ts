import { describe, expect, it } from "vitest";
import {
  buildHomeJobSearch,
  emptyHomeSearchDraft,
} from "@/frontend/features/home/home-search-config";

describe("Home search handoff", () => {
  it("serializes only the concise hero criteria", () => {
    const params = buildHomeJobSearch({
      ...emptyHomeSearchDraft,
      keyword: "  frontend ",
      location: "Hà Nội",
    });
    expect([...params.keys()]).toEqual(["q", "location"]);
    expect(params.get("q")).toBe("frontend");
    expect(params.get("location")).toBe("Hà Nội");
    expect(params.has("role")).toBe(false);
  });
  it("rejects oversized free-text input", () => {
    expect(() =>
      buildHomeJobSearch({ ...emptyHomeSearchDraft, keyword: "x".repeat(201) }),
    ).toThrow();
  });
});
