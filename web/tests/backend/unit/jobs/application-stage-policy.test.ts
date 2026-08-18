import { describe, expect, it } from "vitest";
import {
  canTransitionApplicationStage,
  isTerminalApplicationStage,
  ordinaryApplicationTransitions,
} from "@/backend/services/jobs/application-stage-policy";
import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

const expected: Record<ApplicationStage, ApplicationStage[]> = {
  APPLIED: ["VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "REJECTED", "WAITLISTED"],
  VIEWED: ["SHORTLISTED", "INTERVIEWING", "OFFERED", "REJECTED", "WAITLISTED"],
  SHORTLISTED: ["INTERVIEWING", "OFFERED", "REJECTED", "WAITLISTED"],
  INTERVIEWING: ["OFFERED", "REJECTED", "WAITLISTED"],
  OFFERED: ["HIRED", "OFFER_DECLINED", "REJECTED", "WAITLISTED"],
  HIRED: [],
  OFFER_DECLINED: [],
  REJECTED: [],
  WAITLISTED: ["VIEWED", "SHORTLISTED", "INTERVIEWING", "OFFERED", "REJECTED"],
};

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

  it("defines every allowed and disallowed pair across all nine stages", () => {
    const stages = Object.keys(expected) as ApplicationStage[];
    expect(ordinaryApplicationTransitions).toEqual(expected);
    for (const from of stages) {
      for (const to of stages) {
        expect(canTransitionApplicationStage(from, to), `${from} -> ${to}`).toBe(
          expected[from].includes(to),
        );
      }
    }
  });
});
