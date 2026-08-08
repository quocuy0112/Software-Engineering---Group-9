import { describe, expect, it } from "vitest";
import {
  canTransitionApplicationStage,
  isTerminalApplicationStage,
} from "@/backend/services/jobs/application-stage-policy";

describe("application stage transition policy", () => {
  it("allows genuine forward skips without fabricated intermediate stages", () => {
    expect(canTransitionApplicationStage("APPLIED", "SHORTLISTED")).toBe(true);
    expect(canTransitionApplicationStage("VIEWED", "OFFERED")).toBe(true);
  });

  it("allows active applications to be rejected or waitlisted", () => {
    expect(canTransitionApplicationStage("INTERVIEWING", "REJECTED")).toBe(
      true,
    );
    expect(canTransitionApplicationStage("SHORTLISTED", "WAITLISTED")).toBe(
      true,
    );
  });

  it("supports resuming a waitlisted application", () => {
    expect(canTransitionApplicationStage("WAITLISTED", "INTERVIEWING")).toBe(
      true,
    );
  });

  it("keeps terminal stages closed to ordinary transitions", () => {
    for (const stage of ["HIRED", "OFFER_DECLINED", "REJECTED"] as const) {
      expect(isTerminalApplicationStage(stage)).toBe(true);
      expect(canTransitionApplicationStage(stage, "SHORTLISTED")).toBe(false);
    }
  });

  it("does not create duplicate same-stage transitions", () => {
    expect(canTransitionApplicationStage("VIEWED", "VIEWED")).toBe(false);
  });
});
