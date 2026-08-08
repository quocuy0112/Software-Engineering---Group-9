import type { ApplicationStage } from "@/shared/contracts/jobs/applications";

const activeStages = [
  "APPLIED",
  "VIEWED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
] as const satisfies readonly ApplicationStage[];

const terminalStages = new Set<ApplicationStage>([
  "HIRED",
  "OFFER_DECLINED",
  "REJECTED",
]);

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

  if (to === "REJECTED" || to === "WAITLISTED") return true;

  const fromIndex = activeStages.indexOf(from as (typeof activeStages)[number]);
  const toIndex = activeStages.indexOf(to as (typeof activeStages)[number]);
  return fromIndex >= 0 && toIndex > fromIndex;
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
