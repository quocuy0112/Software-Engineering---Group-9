import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

const activeStages = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
] as const satisfies readonly ApplicationStage[];

const terminalStages = new Set<ApplicationStage>(["HIRED", "OFFER_DECLINED"]);

export function isTerminalApplicationStage(stage: ApplicationStage) {
  return terminalStages.has(stage);
}

export function canTransitionApplicationStage(
  from: ApplicationStage,
  to: ApplicationStage,
) {
  if (from === to || isTerminalApplicationStage(from)) return false;

  if (from === "WAITLISTED") {
    return (
      to === "VIEWED" ||
      to === "SHORTLISTED" ||
      to === "INTERVIEWING" ||
      to === "OFFERED" ||
      to === "REJECTED"
    );
  }

  if (from === "OFFERED") {
    return (
      to === "HIRED" ||
      to === "OFFER_DECLINED" ||
      to === "REJECTED" ||
      to === "WAITLISTED"
    );
  }

  if (from === "REJECTED") {
    return (
      to === "APPLIED" ||
      to === "VIEWED" ||
      to === "SHORTLISTED" ||
      to === "INTERVIEWING"
    );
  }

  if (to === "REJECTED" || to === "WAITLISTED") return true;

  const fromIndex = activeStages.indexOf(from as (typeof activeStages)[number]);
  const toIndex = activeStages.indexOf(to as (typeof activeStages)[number]);
  return fromIndex >= 0 && toIndex > fromIndex;
}

/**
 * The capacity reconciler is the only privileged waitlist promotion path.
 * Keep it separate from the ordinary matrix so recruiter controls cannot
 * manufacture an offer outcome for a waitlisted candidate.
 */
export function canCapacityPromoteApplicationStage(
  from: ApplicationStage,
  to: ApplicationStage,
) {
  return from === "WAITLISTED" && to === "HIRED";
}

export const ordinaryApplicationTransitions = Object.freeze(
  Object.fromEntries(
    (
      [
        ...activeStages,
        "HIRED",
        "OFFER_DECLINED",
        "REJECTED",
        "WAITLISTED",
      ] as ApplicationStage[]
    ).map((from) => [
      from,
      (
        [
          ...activeStages,
          "HIRED",
          "OFFER_DECLINED",
          "REJECTED",
          "WAITLISTED",
        ] as ApplicationStage[]
      ).filter((to) => canTransitionApplicationStage(from, to)),
    ]),
  ) as Record<ApplicationStage, ApplicationStage[]>,
);

/**
 * Recruiter pipeline controls intentionally expose a narrower policy than the
 * historical application-stage compatibility matrix above. The compatibility
 * matrix remains available to old read/command adapters, while the standalone
 * Pipeline surface only offers valid next decisions and never lets a recruiter
 * manufacture an offer outcome.
 */
export const recruiterPipelineButtonTransitions = Object.freeze({
  APPLIED: ["VIEWED", "REJECTED", "WAITLISTED"],
  VIEWED: ["SHORTLISTED", "INTERVIEWING", "REJECTED", "WAITLISTED"],
  SHORTLISTED: ["INTERVIEWING", "REJECTED", "WAITLISTED"],
  INTERVIEWING: ["OFFERED", "REJECTED", "WAITLISTED"],
  OFFERED: [],
  HIRED: [],
  OFFER_DECLINED: [],
  REJECTED: ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING"],
  WAITLISTED: [],
} as const satisfies Record<ApplicationStage, readonly ApplicationStage[]>);

export const recruiterPipelineDragTransitions = Object.freeze({
  APPLIED: ["VIEWED", "REJECTED", "WAITLISTED"],
  VIEWED: ["SHORTLISTED", "REJECTED", "WAITLISTED"],
  SHORTLISTED: ["INTERVIEWING", "REJECTED", "WAITLISTED"],
  INTERVIEWING: ["REJECTED", "WAITLISTED"],
  OFFERED: [],
  HIRED: [],
  OFFER_DECLINED: [],
  REJECTED: ["APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEWING"],
  WAITLISTED: [],
} as const satisfies Record<ApplicationStage, readonly ApplicationStage[]>);

export function canRecruiterPipelineTransition(
  from: ApplicationStage,
  to: ApplicationStage,
  intent: "button" | "drag" = "button",
) {
  const transitions =
    intent === "drag"
      ? recruiterPipelineDragTransitions
      : recruiterPipelineButtonTransitions;
  return (transitions[from] as readonly ApplicationStage[]).includes(to);
}
