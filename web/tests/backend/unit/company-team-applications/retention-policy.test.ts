import { describe, expect, it } from "vitest";
import {
  TEAM_APPLICATION_CV_RETENTION_MS,
  teamApplicationCvDeleteAfter,
} from "@/backend/services/company-members/team-application-retention-policy";

describe("Team Application CV retention policy", () => {
  it("schedules deletion after the post-decision retention window", () => {
    const decidedAt = new Date("2026-08-27T00:00:00.000Z");
    expect(teamApplicationCvDeleteAfter(decidedAt)).toEqual(
      new Date(decidedAt.getTime() + TEAM_APPLICATION_CV_RETENTION_MS),
    );
  });

  it("rejects an invalid clock value", () => {
    expect(() => teamApplicationCvDeleteAfter(new Date("invalid"))).toThrow(
      "TEAM_CV_CLOCK_INVALID",
    );
  });
});
