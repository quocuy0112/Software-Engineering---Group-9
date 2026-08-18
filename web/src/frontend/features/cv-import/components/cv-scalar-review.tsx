"use client";

import type {
  CvDraftComparison,
  CvEditableProposals,
  CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";
import { CvEvidence } from "./cv-evidence";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvActionLabel, cvCopy, cvFieldLabel } from "../i18n/cv-import-copy";
import styles from "./cv-scalar-review.module.css";

type ScalarProposal = CvEditableProposals["scalars"][number];

export function CvScalarReview({
  currentProfile,
  proposals,
  decisions,
  fieldErrors,
  onProposalChange,
  onDecisionChange,
}: {
  currentProfile: CvDraftComparison["currentProfile"];
  proposals: CvEditableProposals["scalars"];
  decisions: CvReviewDecisions["scalars"];
  fieldErrors: Readonly<Record<string, string>>;
  onProposalChange: (proposalId: string, value: string) => void;
  onDecisionChange: (
    proposalId: string,
    action: CvReviewDecisions["scalars"][number]["action"],
  ) => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale).review;
  const decisionsById = new Map(
    decisions.map((decision) => [decision.proposalId, decision]),
  );
  return (
    <section className={styles.root} aria-labelledby="cv-scalar-heading">
      <h2 id="cv-scalar-heading">Profile details</h2>
      {proposals.map((proposal: ScalarProposal, index) => {
        const currentValue = currentProfile[proposal.field];
        const hasCurrentValue = currentValue !== null;
        const current = currentValue ?? copy.notSet;
        const fieldId = `cv-scalar-${proposal.proposalId}`;
        const fieldPath = `proposals.scalars.${index}.value`;
        const fieldError = fieldErrors[fieldPath];
        const errorId = `${fieldId}-error`;
        const decisionIndex = decisions.findIndex(
          (decision) => decision.proposalId === proposal.proposalId,
        );
        const decisionPath = `reviewDecisions.scalars.${decisionIndex}.action`;
        const decisionError = fieldErrors[decisionPath];
        const decisionErrorId = `${fieldId}-decision-error`;
        const availableActions = hasCurrentValue
          ? (["REPLACE", "SKIP"] as const)
          : (["ADD", "SKIP"] as const);
        return (
          <article className={styles.card} key={proposal.proposalId}>
            <h3>{cvFieldLabel(locale, proposal.field)}</h3>
            <div className={styles.comparison}>
              <div>
                <strong>{copy.currentProfile}</strong>
                <p>{current}</p>
              </div>
              <div>
                <label htmlFor={fieldId}>
                  {copy.proposed} {cvFieldLabel(locale, proposal.field)}
                </label>
                {proposal.field === "summary" ? (
                  <textarea
                    id={fieldId}
                    data-cv-review-field={fieldPath}
                    value={proposal.value}
                    maxLength={5_000}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : undefined}
                    onChange={(event) =>
                      onProposalChange(proposal.proposalId, event.target.value)
                    }
                  />
                ) : (
                  <input
                    id={fieldId}
                    data-cv-review-field={fieldPath}
                    value={proposal.value}
                    maxLength={
                      proposal.field === "phone"
                        ? 32
                        : proposal.field === "location"
                          ? 160
                          : 200
                    }
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : undefined}
                    onChange={(event) =>
                      onProposalChange(proposal.proposalId, event.target.value)
                    }
                  />
                )}
                {fieldError ? (
                  <p className={styles.fieldError} id={errorId}>
                    {fieldError}
                  </p>
                ) : null}
              </div>
            </div>
            <fieldset
              className={styles.choices}
              data-cv-review-field={decisionPath}
              aria-invalid={Boolean(decisionError)}
              aria-describedby={decisionError ? decisionErrorId : undefined}
              tabIndex={decisionError ? -1 : undefined}
            >
              <legend className={styles.srOnly}>
                {copy.decisionFor} {cvFieldLabel(locale, proposal.field)}
              </legend>
              <p className={styles.decisionTitle} aria-hidden="true">
                {copy.decisionFor} {cvFieldLabel(locale, proposal.field)}
              </p>
              <p className={styles.decisionHint}>
                {hasCurrentValue ? copy.alreadyValue : copy.emptyValue}
              </p>
              <div className={styles.actionOptions}>
                {availableActions.map((action) => (
                  <label key={action}>
                    <input
                      type="radio"
                      name={`decision-${proposal.proposalId}`}
                      value={action}
                      checked={
                        decisionsById.get(proposal.proposalId)?.action ===
                        action
                      }
                      onChange={() =>
                        onDecisionChange(proposal.proposalId, action)
                      }
                    />
                    {cvActionLabel(locale, action)}
                  </label>
                ))}
              </div>
              {decisionError ? (
                <p className={styles.fieldError} id={decisionErrorId}>
                  {decisionError}
                </p>
              ) : null}
            </fieldset>
            <CvEvidence evidence={proposal.evidence} />
          </article>
        );
      })}
    </section>
  );
}
