import { describe, expect, it } from "vitest";
import {
  canTransitionApplicationStage,
  canRecruiterPipelineTransition,
  isTerminalApplicationStage,
  ordinaryApplicationTransitions,
  recruiterPipelineButtonTransitions,
  recruiterPipelineDragTransitions,
} from "@/backend/services/jobs/application-stage-policy";
import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

const expected: Record<ApplicationStage, ApplicationStage[]> = {
  APPLIED: [
    "VIEWED",
    "SHORTLISTED",
    "INTERVIEWING",
    "OFFERED",
    "REJECTED",
    "WAITLISTED",
  ],
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

  it("allows Interviewing to reach Offered by button or drag", () => {
    expect(
      canRecruiterPipelineTransition("INTERVIEWING", "OFFERED", "button"),
    ).toBe(true);
    expect(
      canRecruiterPipelineTransition("INTERVIEWING", "OFFERED", "drag"),
    ).toBe(true);
    expect(recruiterPipelineDragTransitions.INTERVIEWING).toContain("OFFERED");
  });

  it("supports resuming a waitlisted application", () => {
    expect(canTransitionApplicationStage("WAITLISTED", "INTERVIEWING")).toBe(
      true,
    );
  });

  it("keeps final outcome stages closed to ordinary transitions", () => {
    for (const stage of ["HIRED", "OFFER_DECLINED", "REJECTED"] as const) {
      expect(isTerminalApplicationStage(stage)).toBe(true);
      expect(canTransitionApplicationStage(stage, "SHORTLISTED")).toBe(false);
    }
  });

  it("keeps terminal pipeline cards without recruiter controls", () => {
    expect(recruiterPipelineButtonTransitions.HIRED).toEqual([]);
    expect(recruiterPipelineDragTransitions.HIRED).toEqual([]);
    expect(recruiterPipelineButtonTransitions.OFFER_DECLINED).toEqual([]);
    expect(recruiterPipelineButtonTransitions.REJECTED).toEqual([]);
    expect(recruiterPipelineDragTransitions.REJECTED).toEqual([]);
  });

  it("limits Waitlisted drag destinations to the four permitted stages", () => {
    expect(recruiterPipelineDragTransitions.WAITLISTED).toEqual([
      "VIEWED",
      "SHORTLISTED",
      "INTERVIEWING",
      "REJECTED",
    ]);
    for (const stage of [
      "VIEWED",
      "SHORTLISTED",
      "INTERVIEWING",
      "REJECTED",
    ] as const) {
      expect(canRecruiterPipelineTransition("WAITLISTED", stage, "drag")).toBe(
        true,
      );
    }
    for (const stage of [
      "APPLIED",
      "OFFERED",
      "HIRED",
      "OFFER_DECLINED",
      "WAITLISTED",
    ] as const) {
      expect(canRecruiterPipelineTransition("WAITLISTED", stage, "drag")).toBe(
        false,
      );
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
        expect(
          canTransitionApplicationStage(from, to),
          `${from} -> ${to}`,
        ).toBe(expected[from].includes(to));
      }
    }
  });
});
