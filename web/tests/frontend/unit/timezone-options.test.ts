import { describe, expect, it } from "vitest";
import { getTimezoneOptions } from "@/frontend/features/profile/client/timezone-options";

describe("timezone options", () => {
  it("uses the runtime IANA list and presents canonical IDs with GMT offsets", () => {
    const options = getTimezoneOptions(
      ["Asia/Ho_Chi_Minh"],
      new Date("2026-08-02T00:00:00.000Z"),
    );

    expect(options.length).toBeGreaterThan(400);
    expect(options).toContainEqual({
      value: "UTC",
      label: "GMT+00:00 · UTC",
    });
    expect(options).toContainEqual({
      value: "Asia/Ho_Chi_Minh",
      label: "GMT+07:00 · Asia — Ho Chi Minh",
    });
    expect(options.some((option) => option.value === "Europe/Paris")).toBe(
      true,
    );
  });
});
