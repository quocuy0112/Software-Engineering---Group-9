import type {
  CvDraftComparison,
  CvEditableProposals,
  CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";
import { CvEvidence } from "./cv-evidence";
import styles from "./cv-scalar-review.module.css";

type ScalarProposal = CvEditableProposals["scalars"][number];

export function CvScalarReview({
  currentProfile,
  proposals,
  decisions,
  onProposalChange,
  onDecisionChange,
}: {
  currentProfile: CvDraftComparison["currentProfile"];
  proposals: CvEditableProposals["scalars"];
  decisions: CvReviewDecisions["scalars"];
  onProposalChange: (proposalId: string, value: string) => void;
  onDecisionChange: (
    proposalId: string,
    action: CvReviewDecisions["scalars"][number]["action"],
  ) => void;
}) {
  const decisionsById = new Map(
    decisions.map((decision) => [decision.proposalId, decision]),
  );
  return (
    <section className={styles.root} aria-labelledby="cv-scalar-heading">
      <h2 id="cv-scalar-heading">Profile details</h2>
      {proposals.map((proposal: ScalarProposal) => {
        const current = currentProfile[proposal.field] ?? "Not set";
        const fieldId = `cv-scalar-${proposal.proposalId}`;
        return (
          <article className={styles.card} key={proposal.proposalId}>
            <h3>{proposal.field}</h3>
            <div className={styles.comparison}>
              <div>
                <strong>Current profile</strong>
                <p>{current}</p>
              </div>
              <div>
                <label htmlFor={fieldId}>Proposed {proposal.field}</label>
                {proposal.field === "summary" ? (
                  <textarea
                    id={fieldId}
                    value={proposal.value}
                    maxLength={5_000}
                    onChange={(event) =>
                      onProposalChange(proposal.proposalId, event.target.value)
                    }
                  />
                ) : (
                  <input
                    id={fieldId}
                    value={proposal.value}
                    maxLength={
                      proposal.field === "phone"
                        ? 32
                        : proposal.field === "location"
                          ? 160
                          : 200
                    }
                    onChange={(event) =>
                      onProposalChange(proposal.proposalId, event.target.value)
                    }
                  />
                )}
              </div>
            </div>
            <fieldset className={styles.choices}>
              <legend>Decision for {proposal.field}</legend>
              {(["ADD", "REPLACE", "SKIP"] as const).map((action) => (
                <label key={action}>
                  <input
                    type="radio"
                    name={`decision-${proposal.proposalId}`}
                    value={action}
                    checked={
                      decisionsById.get(proposal.proposalId)?.action === action
                    }
                    onChange={() =>
                      onDecisionChange(proposal.proposalId, action)
                    }
                  />
                  {action.toLowerCase()}
                </label>
              ))}
            </fieldset>
            <CvEvidence evidence={proposal.evidence} />
          </article>
        );
      })}
    </section>
  );
}
