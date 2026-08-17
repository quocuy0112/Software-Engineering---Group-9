"use client";

import { Check, Clock3, LoaderCircle } from "lucide-react";

const analysisSteps = [
  ["Read your CV", "Extracted skills, experience and project evidence."],
  ["Understand the job", "Mapped required and preferred qualifications."],
  ["Compare evidence", "Checked each requirement against CV evidence."],
  ["Prepare guidance", "Generated an explainable score and improvement plan."],
] as const;

export function PrivateMatchStepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const labels = ["Choose job and CV", "Analyze evidence", "Review report"];
  return (
    <ol className="private-match-stepper" aria-label="Assessment steps">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const complete = step < activeStep;
        const active = step === activeStep;
        return (
          <li
            className={complete ? "is-complete" : active ? "is-active" : undefined}
            aria-current={active ? "step" : undefined}
            key={label}
          >
            <span aria-hidden="true">{complete ? <Check /> : step}</span>
            <div>
              <small>Step {step}</small>
              <strong>{label}</strong>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function PrivateMatchAnalysisSteps({
  activeStep = 4,
}: {
  activeStep?: 1 | 2 | 3 | 4;
}) {
  return (
    <ol className="private-match-analysis-list">
      {analysisSteps.map(([title, description], index) => {
        const step = index + 1;
        const allComplete = activeStep === 4;
        const complete = allComplete || step < activeStep;
        const current = !allComplete && activeStep === step;
        return (
          <li
            className={complete ? "is-complete" : current ? "is-current" : "is-pending"}
            key={title}
          >
            <span className="private-match-analysis-icon" aria-hidden="true">
              {complete ? <Check /> : current ? <LoaderCircle className="private-match-spin" /> : <Clock3 />}
            </span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
            <span className="private-match-badge">
              {complete ? "Complete" : current ? "In progress" : "Next"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
