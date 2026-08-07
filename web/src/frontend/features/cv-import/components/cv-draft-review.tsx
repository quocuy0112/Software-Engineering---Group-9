"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

import {
  presentCvReviewFieldError,
  useCvDraftReview,
  type CvReviewFieldError,
} from "../client/use-cv-draft-review";
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
import { cvFieldLabel } from "../i18n/cv-import-copy";

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
  locale: "vi" | "en";
}) {
  const result = saveCvDraftRequestSchema.safeParse({
    baseDraftRevision: input.comparison.draftRevision,
    reviewedProfileRevision: input.comparison.currentProfile.revision,
    proposals: input.proposals,
    reviewDecisions: input.decisions,
  });
  const fieldErrors: CvReviewFieldError[] = result.success
    ? []
    : result.error.issues.slice(0, 20).map((issue) => {
        const path = issue.path.join(".") || "request";
        const label = cvFieldLabel(input.locale, path);
        const message =
          issue.code === "too_small"
            ? input.locale === "vi"
              ? `${label} là bắt buộc.`
              : `${label} is required.`
            : issue.code === "too_big"
              ? input.locale === "vi"
                ? `${label} quá dài.`
                : `${label} is too long.`
              : issue.code === "invalid_format"
                ? input.locale === "vi"
                  ? `${label} có định dạng không hợp lệ.`
                  : `${label} has an invalid format.`
                : issue.message;
        return presentCvReviewFieldError(
          { path, code: issue.code, message },
          input.locale,
        );
      });
  const requiredErrors: CvReviewFieldError[] = [];
  input.proposals.scalars.forEach((proposal, index) => {
    if (!proposal.value.trim())
      requiredErrors.push({
        path: `proposals.scalars.${index}.value`,
        code: "REQUIRED",
        message:
          input.locale === "vi"
            ? `${cvFieldLabel(input.locale, proposal.field)} là bắt buộc.`
            : `${cvFieldLabel(input.locale, proposal.field)} is required.`,
      });
  });
  input.proposals.experiences.forEach((proposal, index) => {
    for (const [field, label] of [
      ["title", cvFieldLabel(input.locale, "title")],
      ["company", cvFieldLabel(input.locale, "company")],
    ] as const) {
      if (!proposal.value[field].trim())
        requiredErrors.push({
          path: `proposals.experiences.${index}.value.${field}`,
          code: "REQUIRED",
          message:
            input.locale === "vi"
              ? `${label} là bắt buộc.`
              : `${label} is required.`,
        });
    }
  });
  input.proposals.education.forEach((proposal, index) => {
    for (const [field, label] of [
      ["institution", cvFieldLabel(input.locale, "institution")],
      ["degree", cvFieldLabel(input.locale, "degree")],
    ] as const) {
      if (!proposal.value[field].trim())
        requiredErrors.push({
          path: `proposals.education.${index}.value.${field}`,
          code: "REQUIRED",
          message:
            input.locale === "vi"
              ? `${label} là bắt buộc.`
              : `${label} is required.`,
        });
    }
  });
  input.proposals.skills.forEach((proposal, index) => {
    if (!proposal.value.trim())
      requiredErrors.push({
        path: `proposals.skills.${index}.value`,
        code: "REQUIRED",
        message:
          input.locale === "vi" ? "Kỹ năng là bắt buộc." : "Skill is required.",
      });
  });
  const decisionErrors: CvReviewFieldError[] = [];
  input.decisions.scalars.forEach((decision, index) => {
    if (decision.action === "SKIP") return;
    const proposal = input.proposals.scalars.find(
      (candidate) => candidate.proposalId === decision.proposalId,
    );
    if (!proposal) {
      decisionErrors.push({
        path: `reviewDecisions.scalars.${index}.action`,
        code: "ACTION_MISMATCH",
        message:
          input.locale === "vi"
            ? "Hãy chọn hành động hợp lệ cho trường hồ sơ được đề xuất này."
            : "Choose a valid action for this proposed profile field.",
      });
      return;
    }
    const current = input.comparison.currentProfile[proposal.field];
    const label = cvFieldLabel(input.locale, proposal.field);
    if (decision.action === "ADD" && current !== null)
      decisionErrors.push({
        path: `reviewDecisions.scalars.${index}.action`,
        code: "ACTION_MISMATCH",
        message:
          input.locale === "vi"
            ? `${label} đã có giá trị trong Hồ sơ. Hãy chọn thay thế hoặc bỏ qua.`
            : `${label} already has a Profile value. Choose replace or skip.`,
      });
    if (decision.action === "REPLACE" && current === null)
      decisionErrors.push({
        path: `reviewDecisions.scalars.${index}.action`,
        code: "ACTION_MISMATCH",
        message:
          input.locale === "vi"
            ? `${label} chưa được thiết lập trong Hồ sơ. Hãy chọn thêm hoặc bỏ qua.`
            : `${label} is not set on the Profile. Choose add or skip.`,
      });
  });
  fieldErrors.unshift(...requiredErrors, ...decisionErrors);
  const issues: string[] = [];
  if (!input.decisions.reviewComplete)
    issues.push(
      input.locale === "vi"
        ? "Hãy đánh dấu bản xem xét là hoàn tất trước khi xác nhận."
        : "Mark the review as complete before confirmation.",
    );
  for (const group of ["experiences", "education", "socialLinks"] as const) {
    if (
      input.decisions[group].some(
        (decision) => decision.action === "REPLACE" && !decision.targetId,
      )
    ) {
      const message =
        input.locale === "vi"
          ? `Hãy chọn mục Hồ sơ hiện tại cho từng lần thay thế ${group}.`
          : `Choose a current Profile target for each ${group} replacement.`;
      issues.push(message);
      input.decisions[group].forEach((decision, index) => {
        if (decision.action === "REPLACE" && !decision.targetId)
          fieldErrors.push({
            path: `reviewDecisions.${group}.${index}.targetId`,
            code: "REQUIRED",
            message,
          });
      });
    }
  }
  const uniqueFieldErrors: CvReviewFieldError[] = [];
  const fieldPaths = new Set<string>();
  for (const fieldError of fieldErrors) {
    const path = canonicalReviewFieldPath(fieldError.path, input.proposals);
    if (fieldPaths.has(path)) continue;
    fieldPaths.add(path);
    uniqueFieldErrors.push(fieldError);
  }
  return {
    issues: [
      ...new Set([
        ...uniqueFieldErrors.map((fieldError) => fieldError.message),
        ...issues,
      ]),
    ],
    fieldErrors: uniqueFieldErrors,
  };
}

function canonicalReviewFieldPath(
  path: string,
  proposals: CvEditableProposals,
) {
  if (path.startsWith("proposals.")) {
    const parts = path.split(".");
    const group = parts[1];
    const index = parts[2];
    if (group === "scalars" && index && !parts.includes("value"))
      return `proposals.scalars.${index}.value`;
    if (
      ["experiences", "education"].includes(group ?? "") &&
      index &&
      parts[3] !== "value"
    )
      return ["proposals", group, index, "value", ...parts.slice(3)].join(".");
    return path;
  }
  const collection = path.match(
    /^(experiences|education)\.(\d+)\.(title|company|description|institution|degree|field|startDate|endDate|isCurrent)$/u,
  );
  if (collection)
    return `proposals.${collection[1]}.${collection[2]}.value.${collection[3]}`;
  const scalarField = path.match(
    /^basics\.(headline|summary|phone|location)$/u,
  );
  if (scalarField) {
    const index = proposals.scalars.findIndex(
      (proposal) => proposal.field === scalarField[1],
    );
    if (index >= 0) return `proposals.scalars.${index}.value`;
  }
  const skill = path.match(/^skills(?:\.(\d+))?(?:\.label|\.value)?$/u);
  if (skill) return `proposals.skills.${skill[1] ?? "0"}.value`;
  const link = path.match(/^socialLinks(?:\.(\d+))?(?:\.url|\.value)?$/u);
  if (link) return `proposals.socialLinks.${link[1] ?? "0"}.value`;
  if (path.startsWith("reviewDecisions.")) {
    const parts = path.split(".");
    if (parts.length === 3) return `${path}.targetId`;
  }
  return path;
}

function reviewFieldErrorMap(
  fieldErrors: readonly CvReviewFieldError[],
  proposals: CvEditableProposals,
) {
  const output: Record<string, string> = {};
  for (const fieldError of fieldErrors) {
    const path = canonicalReviewFieldPath(fieldError.path, proposals);
    output[path] ??= fieldError.message;
  }
  return output;
}

export function CvDraftReview({
  initial,
  csrfProof,
}: {
  initial: CvDraftComparison;
  csrfProof: string;
}) {
  const locale = useWorkspaceLocale();
  const review = useCvDraftReview({ initial, csrfProof });
  const [acknowledged, setAcknowledged] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const validationHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const validation = useMemo(
    () =>
      validationIssues({
        comparison: review.authoritative,
        proposals: review.proposals,
        decisions: review.decisions,
        locale,
      }),
    [locale, review.authoritative, review.decisions, review.proposals],
  );
  const issues = validation.issues;
  const visibleFieldErrors = useMemo(
    () =>
      reviewFieldErrorMap(
        [
          ...(showValidation ? validation.fieldErrors : []),
          ...review.fieldErrors,
        ],
        review.proposals,
      ),
    [
      review.fieldErrors,
      review.proposals,
      showValidation,
      validation.fieldErrors,
    ],
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
    if (
      !review.conflict &&
      !hadConflict.current &&
      showValidation &&
      (issues.length || !acknowledged) &&
      validation.fieldErrors.length === 0 &&
      review.fieldErrors.length === 0
    )
      validationHeading.current?.focus();
  }, [
    acknowledged,
    issues.length,
    review.conflict,
    review.fieldErrors.length,
    showValidation,
    validation.fieldErrors.length,
  ]);
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
  const serverErrorSignature = review.fieldErrors
    .map((fieldError) => `${fieldError.path}:${fieldError.code}`)
    .join("|");
  const hadServerFieldErrors = useRef(false);
  useEffect(() => {
    if (!serverErrorSignature) {
      hadServerFieldErrors.current = false;
      return;
    }
    if (hadServerFieldErrors.current) return;
    hadServerFieldErrors.current = true;
    const firstPath = Object.keys(visibleFieldErrors)[0];
    const target = Array.from(
      form.current?.querySelectorAll<HTMLElement>("[data-cv-review-field]") ??
        [],
    ).find((element) => element.dataset.cvReviewField === firstPath);
    target?.focus();
  }, [serverErrorSignature, visibleFieldErrors]);

  const focusField = (path: string | undefined) => {
    if (!path) return;
    const canonical = canonicalReviewFieldPath(path, review.proposals);
    const target = Array.from(
      form.current?.querySelectorAll<HTMLElement>("[data-cv-review-field]") ??
        [],
    ).find((element) => element.dataset.cvReviewField === canonical);
    target?.focus();
  };

  const changeScalarValue = (proposalId: string, value: string) => {
    const index = review.proposals.scalars.findIndex(
      (proposal) => proposal.proposalId === proposalId,
    );
    const field = review.proposals.scalars[index]?.field;
    review.clearFieldErrors([
      `proposals.scalars.${index}.value`,
      ...(field ? [`basics.${field}`, `scalars.${field}`] : []),
    ]);
    review.setProposals((current) => ({
      ...current,
      scalars: current.scalars.map((proposal) =>
        proposal.proposalId === proposalId ? { ...proposal, value } : proposal,
      ),
    }));
  };

  const changeScalarDecision = (
    proposalId: string,
    action: CvReviewDecisions["scalars"][number]["action"],
  ) => {
    const index = review.decisions.scalars.findIndex(
      (decision) => decision.proposalId === proposalId,
    );
    review.clearFieldErrors([
      `reviewDecisions.scalars.${index}`,
      `reviewDecisions.scalars.${index}.action`,
    ]);
    review.setDecisions((current) => ({
      ...current,
      scalars: current.scalars.map((decision) =>
        decision.proposalId === proposalId ? { ...decision, action } : decision,
      ),
    }));
  };

  const changeCollectionValue = (
    group: CollectionGroup,
    proposalId: string,
    field: string,
    value: string | boolean | null,
  ) => {
    const index = review.proposals[group].findIndex(
      (proposal) => proposal.proposalId === proposalId,
    );
    const canonicalPath =
      group === "experiences" || group === "education"
        ? `proposals.${group}.${index}.value.${field}`
        : `proposals.${group}.${index}.value`;
    review.clearFieldErrors([
      canonicalPath,
      `${group}.${index}.${field}`,
      ...(group === "skills" ? ["skills.label"] : []),
      ...(group === "socialLinks" ? ["socialLinks.url"] : []),
    ]);
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
    const index = review.decisions[group].findIndex(
      (decision) => decision.proposalId === proposalId,
    );
    review.clearFieldErrors([
      `reviewDecisions.${group}.${index}`,
      `reviewDecisions.${group}.${index}.targetId`,
    ]);
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
    review.clearFieldErrors(
      review.decisions[group].flatMap((_, index) => [
        `reviewDecisions.${group}.${index}`,
        `reviewDecisions.${group}.${index}.targetId`,
      ]),
    );
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
    const blockingIssues = issues.filter(
      (issue) =>
        !issue.startsWith(
          locale === "vi" ? "Hãy đánh dấu bản xem xét" : "Mark the review",
        ),
    );
    if (blockingIssues.length) {
      toast.error(
        locale === "vi"
          ? "Không thể lưu bản xem xét."
          : "Review could not be saved.",
        {
          id: "cv-review-save-error",
          description:
            blockingIssues.length === 1
              ? blockingIssues[0]
              : locale === "vi"
                ? `${blockingIssues[0]} Hãy kiểm tra ${blockingIssues.length} trường được đánh dấu.`
                : `${blockingIssues[0]} Check ${blockingIssues.length} highlighted fields.`,
        },
      );
      focusField(validation.fieldErrors[0]?.path);
      return;
    }
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
      ref={form}
      className={styles.root}
      data-testid="cv-draft-review"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      onSubmit={(event) => event.preventDefault()}
    >
      <header className={styles.header}>
        <p>
          {locale === "vi"
            ? "Phiên bản bản nháp xem xét"
            : "Review draft revision"}{" "}
          {review.authoritative.draftRevision}
        </p>
        <h1 ref={reviewHeading} tabIndex={-1}>
          {locale === "vi" ? "Xem xét đề xuất từ CV" : "Review CV proposals"}
        </h1>
        <p>
          {locale === "vi"
            ? "Các giá trị được phân tích chỉ là đề xuất. Hãy chỉnh sửa và chọn nội dung được đưa vào Hồ sơ ứng viên."
            : "Parsed values are suggestions. Edit them and choose what reaches your Candidate Profile."}
        </p>
      </header>

      <CvReviewFeedback
        message={review.message}
        error={review.error}
        fieldErrors={review.fieldErrors}
        dirty={review.dirty}
      />
      {review.conflict ? (
        <CvReviewConflictPanel
          conflict={review.conflict}
          pending={Boolean(review.pending)}
          unsavedSummary={
            locale === "vi"
              ? `Đã chọn ${selectedCount} thay đổi được đề xuất.`
              : `${selectedCount} proposed changes are selected.`
          }
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
            {locale === "vi" ? "Hoàn tất bản xem xét" : "Complete the review"}
          </h2>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
            {!acknowledged ? (
              <li>
                {locale === "vi"
                  ? "Xác nhận rằng thao tác xác nhận sẽ cập nhật Hồ sơ của bạn."
                  : "Acknowledge that confirmation updates your Profile."}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <CvScalarReview
        currentProfile={review.authoritative.currentProfile}
        proposals={review.proposals.scalars}
        decisions={review.decisions.scalars}
        fieldErrors={visibleFieldErrors}
        onProposalChange={changeScalarValue}
        onDecisionChange={changeScalarDecision}
      />
      <CvCollectionReview
        currentProfile={review.authoritative.currentProfile}
        proposals={review.proposals}
        decisions={review.decisions}
        fieldErrors={visibleFieldErrors}
        onValueChange={changeCollectionValue}
        onDecisionChange={changeCollectionDecision}
        onSetGroupAction={setGroupAction}
      />

      <section
        className={styles.completion}
        aria-labelledby="review-complete-heading"
      >
        <h2 id="review-complete-heading">
          {locale === "vi" ? "Lưu và xác nhận" : "Save and confirm"}
        </h2>
        <p>
          {locale === "vi"
            ? `Đã chọn ${selectedCount} thay đổi được đề xuất; các mục bỏ qua vẫn giữ nguyên.`
            : `${selectedCount} proposed changes selected; skipped items remain unchanged.`}
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
          {locale === "vi"
            ? "Tôi đã xem xét mọi đề xuất."
            : "I have reviewed every proposal."}
        </label>
        <label>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          {locale === "vi"
            ? "Tôi hiểu rằng Xác nhận sẽ cập nhật Hồ sơ ứng viên và chuyển bản nháp này thành chỉ đọc."
            : "I understand that Confirm updates my Candidate Profile and makes this draft read-only."}
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
            {review.pending === "save"
              ? locale === "vi"
                ? "Đang lưu bản xem xét…"
                : "Saving review…"
              : locale === "vi"
                ? "Lưu bản xem xét"
                : "Save review"}
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
              ? locale === "vi"
                ? "Đang xác nhận…"
                : "Confirming…"
              : locale === "vi"
                ? "Xác nhận các thay đổi đã chọn"
                : "Confirm selected changes"}
          </button>
        </div>
      </section>
    </form>
  );
}
