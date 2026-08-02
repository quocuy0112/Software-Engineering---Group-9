import type {
  CvDraftComparison,
  CvEditableProposals,
  CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";
import { CvEvidence } from "./cv-evidence";
import styles from "./cv-collection-review.module.css";

type CollectionGroup = "experiences" | "education" | "skills" | "socialLinks";
type EntryAction = "ADD" | "REPLACE" | "SKIP";

function DecisionControls({
  proposalId,
  label,
  action,
  targetId,
  targets,
  allowReplace = true,
  onChange,
}: {
  proposalId: string;
  label: string;
  action: EntryAction;
  targetId?: string | null;
  targets: readonly { id: string; label: string }[];
  allowReplace?: boolean;
  onChange: (action: EntryAction, targetId: string | null) => void;
}) {
  return (
    <fieldset className={styles.choices}>
      <legend>Decision for {label}</legend>
      {(
        [
          "ADD",
          ...(allowReplace ? (["REPLACE"] as const) : []),
          "SKIP",
        ] as const
      ).map((candidate) => (
        <label key={candidate}>
          <input
            type="radio"
            name={`decision-${proposalId}`}
            checked={action === candidate}
            onChange={() =>
              onChange(
                candidate,
                candidate === "REPLACE"
                  ? (targetId ?? targets[0]?.id ?? null)
                  : null,
              )
            }
          />
          {candidate.toLowerCase()}
        </label>
      ))}
      {action === "REPLACE" ? (
        <label className={styles.target}>
          Replace current item
          <select
            value={targetId ?? ""}
            required
            onChange={(event) =>
              onChange("REPLACE", event.target.value || null)
            }
          >
            <option value="">Choose an owned profile item</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}

export function CvCollectionReview({
  currentProfile,
  proposals,
  decisions,
  onValueChange,
  onDecisionChange,
  onSetGroupAction,
}: {
  currentProfile: CvDraftComparison["currentProfile"];
  proposals: CvEditableProposals;
  decisions: CvReviewDecisions;
  onValueChange: (
    group: CollectionGroup,
    proposalId: string,
    field: string,
    value: string | boolean | null,
  ) => void;
  onDecisionChange: (
    group: CollectionGroup,
    proposalId: string,
    action: EntryAction,
    targetId: string | null,
  ) => void;
  onSetGroupAction: (group: CollectionGroup, action: "ADD" | "SKIP") => void;
}) {
  const entryDecision = (group: CollectionGroup, proposalId: string) => {
    const values = decisions[group] as readonly {
      proposalId: string;
      action: EntryAction;
      targetId?: string | null;
    }[];
    return (
      values.find((value) => value.proposalId === proposalId) ?? {
        proposalId,
        action: "SKIP" as const,
        targetId: null,
      }
    );
  };
  const groupControls = (group: CollectionGroup, label: string) => (
    <div className={styles.groupControls} aria-label={`${label} bulk controls`}>
      <button type="button" onClick={() => onSetGroupAction(group, "ADD")}>
        Add all proposed {label}
      </button>
      <button type="button" onClick={() => onSetGroupAction(group, "SKIP")}>
        Skip all proposed {label}
      </button>
    </div>
  );
  return (
    <section className={styles.root} aria-labelledby="cv-collections-heading">
      <h2 id="cv-collections-heading">Experience, education, and links</h2>

      <section className={styles.group} aria-labelledby="cv-experience-heading">
        <h3 id="cv-experience-heading">Experience</h3>
        {groupControls("experiences", "experience")}
        {proposals.experiences.map((proposal) => {
          const decision = entryDecision("experiences", proposal.proposalId);
          return (
            <article className={styles.card} key={proposal.proposalId}>
              <div className={styles.fields}>
                <label>
                  Job title
                  <input
                    value={proposal.value.title}
                    maxLength={200}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "title",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Company
                  <input
                    value={proposal.value.company}
                    maxLength={200}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "company",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Start date
                  <input
                    type="date"
                    value={proposal.value.startDate}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "startDate",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    disabled={proposal.value.isCurrent}
                    value={proposal.value.endDate ?? ""}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "endDate",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={proposal.value.isCurrent}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "isCurrent",
                        event.target.checked,
                      )
                    }
                  />
                  Current role
                </label>
                <label className={styles.fullWidth}>
                  Description
                  <textarea
                    value={proposal.value.description ?? ""}
                    maxLength={3_000}
                    onChange={(event) =>
                      onValueChange(
                        "experiences",
                        proposal.proposalId,
                        "description",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
              </div>
              <DecisionControls
                proposalId={proposal.proposalId}
                label={`${proposal.value.title} at ${proposal.value.company}`}
                action={decision.action}
                targetId={decision.targetId}
                targets={currentProfile.experiences.map((entry) => ({
                  id: entry.id,
                  label: `${entry.title} at ${entry.company}`,
                }))}
                onChange={(action, targetId) =>
                  onDecisionChange(
                    "experiences",
                    proposal.proposalId,
                    action,
                    targetId,
                  )
                }
              />
              <CvEvidence evidence={proposal.evidence} />
            </article>
          );
        })}
      </section>

      <section className={styles.group} aria-labelledby="cv-education-heading">
        <h3 id="cv-education-heading">Education</h3>
        {groupControls("education", "education")}
        {proposals.education.map((proposal) => {
          const decision = entryDecision("education", proposal.proposalId);
          return (
            <article className={styles.card} key={proposal.proposalId}>
              <div className={styles.fields}>
                {(["institution", "degree", "field"] as const).map((field) => (
                  <label key={field}>
                    {field}
                    <input
                      value={proposal.value[field] ?? ""}
                      maxLength={200}
                      onChange={(event) =>
                        onValueChange(
                          "education",
                          proposal.proposalId,
                          field,
                          event.target.value || (field === "field" ? null : ""),
                        )
                      }
                    />
                  </label>
                ))}
                <label>
                  Start date
                  <input
                    type="date"
                    value={proposal.value.startDate}
                    onChange={(event) =>
                      onValueChange(
                        "education",
                        proposal.proposalId,
                        "startDate",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    disabled={proposal.value.isCurrent}
                    value={proposal.value.endDate ?? ""}
                    onChange={(event) =>
                      onValueChange(
                        "education",
                        proposal.proposalId,
                        "endDate",
                        event.target.value || null,
                      )
                    }
                  />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={proposal.value.isCurrent}
                    onChange={(event) =>
                      onValueChange(
                        "education",
                        proposal.proposalId,
                        "isCurrent",
                        event.target.checked,
                      )
                    }
                  />
                  Current study
                </label>
              </div>
              <DecisionControls
                proposalId={proposal.proposalId}
                label={`${proposal.value.degree} at ${proposal.value.institution}`}
                action={decision.action}
                targetId={decision.targetId}
                targets={currentProfile.education.map((entry) => ({
                  id: entry.id,
                  label: `${entry.degree} at ${entry.institution}`,
                }))}
                onChange={(action, targetId) =>
                  onDecisionChange(
                    "education",
                    proposal.proposalId,
                    action,
                    targetId,
                  )
                }
              />
              <CvEvidence evidence={proposal.evidence} />
            </article>
          );
        })}
      </section>

      <section className={styles.group} aria-labelledby="cv-skills-heading">
        <h3 id="cv-skills-heading">Skills</h3>
        {groupControls("skills", "skills")}
        {proposals.skills.map((proposal) => {
          const decision = entryDecision("skills", proposal.proposalId);
          return (
            <article className={styles.card} key={proposal.proposalId}>
              <label>
                Proposed skill
                <input
                  value={proposal.value}
                  maxLength={80}
                  onChange={(event) =>
                    onValueChange(
                      "skills",
                      proposal.proposalId,
                      "value",
                      event.target.value,
                    )
                  }
                />
              </label>
              {proposal.duplicate ? (
                <p role="note">A matching skill is already on the profile.</p>
              ) : null}
              <DecisionControls
                proposalId={proposal.proposalId}
                label={proposal.value}
                action={decision.action}
                targets={[]}
                allowReplace={false}
                onChange={(action) =>
                  onDecisionChange("skills", proposal.proposalId, action, null)
                }
              />
              <CvEvidence evidence={proposal.evidence} />
            </article>
          );
        })}
      </section>

      <section className={styles.group} aria-labelledby="cv-links-heading">
        <h3 id="cv-links-heading">Social links</h3>
        {groupControls("socialLinks", "links")}
        {proposals.socialLinks.map((proposal) => {
          const decision = entryDecision("socialLinks", proposal.proposalId);
          return (
            <article className={styles.card} key={proposal.proposalId}>
              <label>
                Proposed URL
                <input
                  type="url"
                  value={proposal.value}
                  maxLength={2_048}
                  onChange={(event) =>
                    onValueChange(
                      "socialLinks",
                      proposal.proposalId,
                      "value",
                      event.target.value,
                    )
                  }
                />
              </label>
              <DecisionControls
                proposalId={proposal.proposalId}
                label={proposal.value}
                action={decision.action}
                targetId={decision.targetId}
                targets={currentProfile.socialLinks.map((entry) => ({
                  id: entry.id,
                  label: entry.url,
                }))}
                onChange={(action, targetId) =>
                  onDecisionChange(
                    "socialLinks",
                    proposal.proposalId,
                    action,
                    targetId,
                  )
                }
              />
              <CvEvidence evidence={proposal.evidence} />
            </article>
          );
        })}
      </section>
    </section>
  );
}
