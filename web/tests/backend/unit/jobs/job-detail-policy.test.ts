import { describe, expect, it } from "vitest";
import { projectPublicJobState } from "@/backend/services/jobs/job-discovery-service";

const now = new Date("2026-08-01T08:00:00.000Z");

describe("public job detail state", () => {
  it("keeps active in-window jobs active", () => {
    expect(projectPublicJobState("ACTIVE", null, now)).toBe("ACTIVE");
  });

  it("projects an active row with a passed deadline as expired", () => {
    expect(
      projectPublicJobState(
        "ACTIVE",
        new Date("2026-08-01T07:59:59.000Z"),
        now,
      ),
    ).toBe("EXPIRED");
  });

  it("preserves closed and expired historical states", () => {
    expect(projectPublicJobState("CLOSED", null, now)).toBe("CLOSED");
    expect(projectPublicJobState("EXPIRED", null, now)).toBe("EXPIRED");
  });
});
