"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useCvDraftReview } from "../client/use-cv-draft-review";
import type {
  CvDraftComparison,
  CvEditableProposals,
  CvReviewDecisions,
} from "@/shared/contracts/cv-import/review";
import { saveCvDraftRequestSchema } from "@/shared/contracts/cv-import/review";
import { CvCollectionReview } from "./cv-collection-review";
import { CvConfirmationReceipt } from "./cv-confirmation-receipt";
import { CvReviewConflictPanel } from "./cv-review-conflict";
import { CvReviewFeedback } from "./cv-review-feedback";
import { CvScalarReview } from "./cv-scalar-review";
import styles from "./cv-draft-review.module.css";

type CollectionGroup = "experiences" | "education" | "skills" | "socialLinks";
type UnsavedPreviewItem = Readonly<{
  id: string;
  label: string;
  value: string;
}>;

const previewExcludedKeys = new Set([
  "duplicate",
  "duplicateTargetIds",
  "evidence",
  "proposalId",
]);

function previewLabel(path: readonly string[]) {
  return path
    .filter((part) => !/^\d+$/u.test(part))
    .map((part) => part.replace(/([a-z])([A-Z])/gu, "$1 $2"))
    .join(" · ");
}

function collectUnsavedPreview(
  current: unknown,
  baseline: unknown,
  path: string[],
  output: UnsavedPreviewItem[],
) {
  if (Object.is(current, baseline)) return;
  if (Array.isArray(current) && Array.isArray(baseline)) {
    for (let index = 0; index < current.length; index += 1)
      collectUnsavedPreview(
        current[index],
        baseline[index],
        [...path, String(index)],
        output,
      );
    return;
  }
  if (
    current !== null &&
    baseline !== null &&
    typeof current === "object" &&
    typeof baseline === "object"
  ) {
    const currentRecord = current as Record<string, unknown>;
    const baselineRecord = baseline as Record<string, unknown>;
    for (const key of Object.keys(currentRecord)) {
      if (previewExcludedKeys.has(key)) continue;
      collectUnsavedPreview(
        currentRecord[key],
        baselineRecord[key],
        [...path, key],
        output,
      );
    }
    return;
  }
  output.push({
    id: path.join("."),
    label: previewLabel(path),
    value:
      current === null || current === ""
        ? "Cleared"
        : typeof current === "boolean"
          ? current
            ? "Yes"
            : "No"
          : String(current),
  });
}

function unsavedPreview(input: {
  authoritative: CvDraftComparison;
  proposals: CvEditableProposals;
  decisions: CvReviewDecisions;
}) {
  const output: UnsavedPreviewItem[] = [];
  collectUnsavedPreview(
    input.proposals,
    input.authoritative.proposals,
    ["proposals"],
    output,
  );
  collectUnsavedPreview(
    input.decisions,
    input.authoritative.reviewDecisions,
    ["review decisions"],
    output,
  );
  return output;
}

function validationIssues(input: {
  comparison: CvDraftComparison;
  proposals: CvEditableProposals;
  decisions: CvReviewDecisions;
}) {
  const result = saveCvDraftRequestSchema.safeParse({
    baseDraftRevision: input.comparison.draftRevision,
    reviewedProfileRevision: input.comparison.currentProfile.revision,
    proposals: input.proposals,
    reviewDecisions: input.decisions,
  });
  const issues = result.success
    ? []
    : result.error.issues.slice(0, 20).map((issue) => issue.message);
  if (!input.decisions.reviewComplete)
    issues.push("Mark the review as complete before confirmation.");
  for (const group of ["experiences", "education", "socialLinks"] as const) {
    if (
      input.decisions[group].some(
        (decision) => decision.action === "REPLACE" && !decision.targetId,
      )
    )
      issues.push(
        `Choose a current Profile target for each ${group} replacement.`,
      );
  }
  return [...new Set(issues)];
}

export function CvDraftReview({
  initial,
  csrfProof,
}: {
  initial: CvDraftComparison;
  csrfProof: string;
}) {
  const review = useCvDraftReview({ initial, csrfProof });
  const [acknowledged, setAcknowledged] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const validationHeading = useRef<HTMLHeadingElement>(null);
  const issues = useMemo(
    () =>
      validationIssues({
        comparison: review.authoritative,
        proposals: review.proposals,
        decisions: review.decisions,
      }),
    [review.authoritative, review.decisions, review.proposals],
  );
  const preview = useMemo(
    () =>
      unsavedPreview({
        authoritative: review.authoritative,
        proposals: review.proposals,
        decisions: review.decisions,
      }),
    [review.authoritative, review.decisions, review.proposals],
  );
  const hadConflict = useRef(false);
  useEffect(() => {
    if (review.conflict) {
      hadConflict.current = true;
      return;
    }
    if (hadConflict.current) {
      hadConflict.current = false;
      reviewHeading.current?.focus();
    }
  }, [review.conflict]);
  useEffect(() => {
    if (showValidation && (issues.length || !acknowledged))
      validationHeading.current?.focus();
  }, [acknowledged, issues.length, showValidation]);

  const changeScalarValue = (proposalId: string, value: string) =>
    review.setProposals((current) => ({
      ...current,
      scalars: current.scalars.map((proposal) =>
        proposal.proposalId === proposalId ? { ...proposal, value } : proposal,
      ),
    }));

  const changeScalarDecision = (
    proposalId: string,
    action: CvReviewDecisions["scalars"][number]["action"],
  ) =>
    review.setDecisions((current) => ({
      ...current,
      scalars: current.scalars.map((decision) =>
        decision.proposalId === proposalId ? { ...decision, action } : decision,
      ),
    }));

  const changeCollectionValue = (
    group: CollectionGroup,
    proposalId: string,
    field: string,
    value: string | boolean | null,
  ) => {
    review.setProposals((current) => {
      if (group === "skills")
        return {
          ...current,
          skills: current.skills.map((proposal) =>
            proposal.proposalId === proposalId && field === "value"
              ? { ...proposal, value: String(value ?? "") }
              : proposal,
          ),
        };
      if (group === "socialLinks")
        return {
          ...current,
          socialLinks: current.socialLinks.map((proposal) =>
            proposal.proposalId === proposalId && field === "value"
              ? { ...proposal, value: String(value ?? "") }
              : proposal,
          ),
        };
      if (group === "experiences")
        return {
          ...current,
          experiences: current.experiences.map((proposal) => {
            if (proposal.proposalId !== proposalId) return proposal;
            const next = { ...proposal.value, [field]: value };
            if (field === "isCurrent" && value === true) next.endDate = null;
            return { ...proposal, value: next };
          }),
        };
      return {
        ...current,
        education: current.education.map((proposal) => {
          if (proposal.proposalId !== proposalId) return proposal;
          const next = { ...proposal.value, [field]: value };
          if (field === "isCurrent" && value === true) next.endDate = null;
          return { ...proposal, value: next };
        }),
      };
    });
  };

  const changeCollectionDecision = (
    group: CollectionGroup,
    proposalId: string,
    action: "ADD" | "REPLACE" | "SKIP",
    targetId: string | null,
  ) => {
    review.setDecisions((current) => {
      if (group === "skills")
        return {
          ...current,
          skills: current.skills.map((decision) =>
            decision.proposalId === proposalId
              ? { ...decision, action: action === "SKIP" ? "SKIP" : "ADD" }
              : decision,
          ),
        };
      const update = <T extends { proposalId: string }>(values: readonly T[]) =>
        values.map((decision) =>
          decision.proposalId === proposalId
            ? {
                ...decision,
                action,
                targetId: action === "REPLACE" ? targetId : null,
              }
            : decision,
        );
      if (group === "experiences")
        return { ...current, experiences: update(current.experiences) };
      if (group === "education")
        return { ...current, education: update(current.education) };
      return { ...current, socialLinks: update(current.socialLinks) };
    });
  };

  const setGroupAction = (group: CollectionGroup, action: "ADD" | "SKIP") => {
    review.setDecisions((current) => {
      if (group === "skills")
        return {
          ...current,
          skills: current.skills.map((decision) => ({ ...decision, action })),
        };
      const update = <T extends { proposalId: string }>(values: readonly T[]) =>
        values.map((decision) => ({ ...decision, action, targetId: null }));
      if (group === "experiences")
        return { ...current, experiences: update(current.experiences) };
      if (group === "education")
        return { ...current, education: update(current.education) };
      return { ...current, socialLinks: update(current.socialLinks) };
    });
  };

  const save = async () => {
    setShowValidation(true);
    if (issues.filter((issue) => !issue.startsWith("Mark the review")).length)
      return;
    await review.save();
  };

  const confirm = async () => {
    setShowValidation(true);
    if (issues.length || !acknowledged) return;
    await review.confirm();
  };

  if (review.receipt) return <CvConfirmationReceipt receipt={review.receipt} />;
  const selectedCount = Object.values(review.decisions)
    .filter(Array.isArray)
    .flat()
    .filter(
      (decision) =>
        typeof decision === "object" &&
        decision !== null &&
        "action" in decision &&
        decision.action !== "SKIP",
    ).length;
  return (
    <form
      className={styles.root}
      data-testid="cv-draft-review"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      onSubmit={(event) => event.preventDefault()}
    >
      <header className={styles.header}>
        <p>Review draft revision {review.authoritative.draftRevision}</p>
        <h1 ref={reviewHeading} tabIndex={-1}>
          Review CV proposals
        </h1>
        <p>
          Parsed values are suggestions. Edit them and choose what reaches your
          Candidate Profile.
        </p>
      </header>

      <CvReviewFeedback
        message={review.message}
        error={review.error}
        dirty={review.dirty}
      />
      {review.conflict ? (
        <CvReviewConflictPanel
          conflict={review.conflict}
          pending={Boolean(review.pending)}
          unsavedSummary={`${selectedCount} proposed changes are selected.`}
          unsavedPreview={preview}
          latestCompared={Boolean(review.latestComparison)}
          onCompareLatest={() => void review.compareLatest()}
          onReapplyLatest={() => void review.reapplyLatest()}
          onDiscardAndReload={() => void review.discardAndReload()}
        />
      ) : null}
      {showValidation && (issues.length || !acknowledged) ? (
        <section className={styles.validation} role="alert">
          <h2 ref={validationHeading} tabIndex={-1}>
            Complete the review
          </h2>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
            {!acknowledged ? (
              <li>Acknowledge that confirmation updates your Profile.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <CvScalarReview
        currentProfile={review.authoritative.currentProfile}
        proposals={review.proposals.scalars}
        decisions={review.decisions.scalars}
        onProposalChange={changeScalarValue}
        onDecisionChange={changeScalarDecision}
      />
      <CvCollectionReview
        currentProfile={review.authoritative.currentProfile}
        proposals={review.proposals}
        decisions={review.decisions}
        onValueChange={changeCollectionValue}
        onDecisionChange={changeCollectionDecision}
        onSetGroupAction={setGroupAction}
      />

      <section
        className={styles.completion}
        aria-labelledby="review-complete-heading"
      >
        <h2 id="review-complete-heading">Save and confirm</h2>
        <p>
          {selectedCount} proposed changes selected; skipped items remain
          unchanged.
        </p>
        <label>
          <input
            type="checkbox"
            checked={review.decisions.reviewComplete}
            onChange={(event) =>
              review.setDecisions((current) => ({
                ...current,
                reviewComplete: event.target.checked,
              }))
            }
          />
          I have reviewed every proposal.
        </label>
        <label>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          I understand that Confirm updates my Candidate Profile and makes this
          draft read-only.
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={
              Boolean(review.pending) ||
              !review.dirty ||
              Boolean(review.conflict)
            }
            onClick={() => void save()}
          >
            {review.pending === "save" ? "Saving review..." : "Save review"}
          </button>
          <button
            type="button"
            disabled={
              Boolean(review.pending) ||
              review.dirty ||
              Boolean(review.conflict)
            }
            onClick={() => void confirm()}
          >
            {review.pending === "confirm"
              ? "Confirming..."
              : "Confirm selected changes"}
          </button>
        </div>
      </section>
    </form>
  );
}
