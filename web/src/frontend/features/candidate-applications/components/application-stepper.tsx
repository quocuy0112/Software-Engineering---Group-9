"use client";

import { Check } from "lucide-react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";

export type ApplicationStep = 1 | 2 | 3;

export function ApplicationStepper({
  currentStep,
}: {
  currentStep: ApplicationStep;
}) {
  const copy = applicationCopy(useWorkspaceLocale());
  const steps = [
    { id: 1 as const, title: copy.stepper.personalInformation },
    { id: 2 as const, title: copy.stepper.applicationFiles },
    { id: 3 as const, title: copy.stepper.reviewAndSubmit },
  ];

  return (
    <ol
      className="application-stepper"
      aria-label={copy.common.applicationSteps}
    >
      {steps.map((step) => {
        const state =
          step.id === currentStep
            ? "current"
            : step.id < currentStep
              ? "complete"
              : "upcoming";

        return (
          <li
            key={step.id}
            className={`application-stepper__step application-stepper__step--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="application-stepper__node" aria-hidden="true">
              {state === "complete" ? <Check /> : step.id}
            </span>
            <span className="application-stepper__label">
              <span className="application-stepper__eyebrow">
                {copy.stepper.step(step.id)}
              </span>
              <strong>{step.title}</strong>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationProgressChecklist({
  currentStep,
  className,
}: {
  currentStep: ApplicationStep;
  className: string;
}) {
  const copy = applicationCopy(useWorkspaceLocale());
  const steps = [
    { id: 1 as const, title: copy.stepper.personalInformation },
    { id: 2 as const, title: copy.stepper.applicationFiles },
    { id: 3 as const, title: copy.stepper.reviewAndSubmit },
  ];

  return (
    <ul className={className}>
      {steps.map((step) => {
        const state =
          step.id === currentStep
            ? "current"
            : step.id < currentStep
              ? "complete"
              : "upcoming";
        return (
          <li
            key={step.id}
            className={state === "upcoming" ? undefined : `is-${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span aria-hidden="true">
              {state === "complete" ? (
                <Check />
              ) : state === "current" ? (
                "•"
              ) : null}
            </span>
            {step.title}
          </li>
        );
      })}
    </ul>
  );
}
