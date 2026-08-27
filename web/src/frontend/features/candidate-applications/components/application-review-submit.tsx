"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  LockKeyhole,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { ApplicationStepper } from "@/frontend/features/candidate-applications/components/application-stepper";
import {
  ApplicationFlowHeader,
  ApplicationFileIcon,
  ReviewSummaryCard,
} from "@/frontend/features/candidate-applications/components/application-wizard-primitives";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import {
  applicationCopy,
  applicationErrorMessage,
} from "@/frontend/features/candidate-applications/i18n/application-copy";
import { jobAttributeLabel } from "@/frontend/features/jobs/components/job-copy";
import {
  applicationReceiptSchema,
  parseApplicationDraftResponse,
  type ApplicationFileDescriptor,
  type ApplicationReview,
} from "@/shared/contracts/candidate-applications";

function messageFrom(body: unknown, fallback: string, locale: "en" | "vi") {
  return body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { message?: unknown }).message === "string"
    ? locale === "en"
      ? (body as { message: string }).message
      : fallback
    : fallback;
}

export function ApplicationReviewSubmit({
  slug,
  review: initialReview,
  csrfProof,
}: {
  slug: string;
  review: ApplicationReview;
  csrfProof: string;
}) {
  const router = useRouter();
  const locale = useWorkspaceLocale();
  const flowCopy = applicationCopy(locale);
  const copy = flowCopy.reviewAndSubmit;
  const commonCopy = flowCopy.common;
  const stepperCopy = flowCopy.stepper;
  const [review, setReview] = useState(initialReview);
  const [confirmed, setConfirmed] = useState(
    initialReview.draft.confirmationAccepted,
  );
  const [message, setMessage] = useState(initialReview.draft.message ?? "");
  const [shareContactWithRecruiter, setShareContactWithRecruiter] =
    useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitKey = useRef<string | null>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const draft = review.draft;
  const hasMessage = Boolean(message.trim());
  const applicationHref = `/jobs/${encodeURIComponent(slug)}/apply?draftId=${encodeURIComponent(draft.draftId)}`;
  const filesHref = `${applicationHref}&step=2`;
  const dueDate = review.job.applicationDeadline
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        new Date(review.job.applicationDeadline),
      )
    : null;
  const jobTags = [
    jobAttributeLabel(review.job.employmentType, locale),
    jobAttributeLabel(review.job.experienceLevel, locale),
    dueDate ? stepperCopy.dueDate(dueDate) : null,
  ].filter((tag): tag is string => Boolean(tag));

  async function save() {
    const response = await mutateWithCurrentCsrf(
      "/api/candidate/application-drafts",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: draft.jobId,
          expectedRevision: draft.revision,
          personalInformation: draft.personalInformation,
          cvVersionId: draft.cv?.versionId ?? null,
          cvSource: draft.cvSource,
          coverLetter: draft.coverLetter,
          message: message.trim() || null,
          confirmationAccepted: confirmed,
        }),
      },
      csrfProof,
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(messageFrom(body, copy.draftSaveError, locale));
    const updated = parseApplicationDraftResponse(body);
    setReview((current) => ({ ...current, draft: updated }));
    return updated;
  }

  async function saveDraft() {
    setPending(true);
    setError(null);
    try {
      await save();
    } catch (caught) {
      setError(applicationErrorMessage(locale, caught, copy.draftSaveError));
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (pending) return;
    if (!confirmed) {
      setError(copy.confirmationRequired);
      return;
    }
    if (!draft.cv) {
      setError(copy.cvRequired);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const updated = await save();
      const idempotencyKey = submitKey.current ?? crypto.randomUUID();
      submitKey.current = idempotencyKey;
      const response = await mutateWithCurrentCsrf(
        "/api/candidate/applications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            draftId: updated.draftId,
            expectedRevision: updated.revision,
            informationConfirmed: true,
            shareContactWithRecruiter,
          }),
        },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code =
          body &&
          typeof body === "object" &&
          !Array.isArray(body) &&
          typeof (body as { code?: unknown }).code === "string"
            ? (body as { code: string }).code
            : null;
        if (code === "APPLICATION_COVER_LETTER_INELIGIBLE") {
          router.push(`${filesHref}&recover=cover-letter`);
          return;
        }
        throw new Error(messageFrom(body, copy.submitError, locale));
      }
      const receipt = applicationReceiptSchema.parse(body);
      router.push(
        `/jobs/applied/${encodeURIComponent(receipt.applicationId)}/processing`,
      );
    } catch (caught) {
      setError(applicationErrorMessage(locale, caught, copy.submitError));
    } finally {
      setPending(false);
    }
  }

  function fileMeta(file: ApplicationFileDescriptor) {
    return [
      copy.pageCount(file.pageCount),
      copy.fileSize(file.byteSize),
      copy.parseStatus[file.parseStatus],
    ].join(" · ");
  }

  function sourcePill() {
    return draft.cvSource === "UPLOADED" ? copy.uploaded : copy.fromProfile;
  }

  return (
    <main
      className="candidate-application-flow application-review-submit"
      aria-labelledby="application-review-title"
    >
      <ApplicationFlowHeader
        titleId="application-review-title"
        eyebrow={copy.eyebrow}
        title={copy.title(review.job.title)}
        subtitle={copy.subtitle}
        saveLabel={commonCopy.saveDraft}
        savingLabel={commonCopy.saving}
        pending={pending}
        onSave={() => void saveDraft()}
      />

      <ApplicationStepper currentStep={3} />

      {error ? (
        <p
          ref={errorRef}
          className="candidate-application-error"
          role="alert"
          tabIndex={-1}
        >
          {error}
        </p>
      ) : null}

      <div className="application-review-submit__grid">
        <div className="application-review-submit__main">
          <ReviewSummaryCard
            title={copy.personalInformation}
            edit={<Link href={applicationHref}>{copy.edit}</Link>}
          >
            <dl className="application-review-submit__summary-grid">
              <div>
                <dt>{copy.fullName}</dt>
                <dd>{draft.personalInformation.fullName}</dd>
              </div>
              <div>
                <dt>{copy.email}</dt>
                <dd>{draft.personalInformation.email}</dd>
              </div>
              <div>
                <dt>{copy.phone}</dt>
                <dd>{draft.personalInformation.phone}</dd>
              </div>
              <div>
                <dt>{copy.currentLocation}</dt>
                <dd>{draft.personalInformation.currentLocation}</dd>
              </div>
              <div>
                <dt>{copy.linkedInPortfolio}</dt>
                <dd
                  className={
                    draft.personalInformation.linkedInPortfolio
                      ? undefined
                      : "is-muted"
                  }
                >
                  {draft.personalInformation.linkedInPortfolio ??
                    copy.notProvided}
                </dd>
              </div>
            </dl>
          </ReviewSummaryCard>

          <ReviewSummaryCard
            title={copy.applicationFiles}
            edit={<Link href={filesHref}>{copy.edit}</Link>}
          >
            <div className="application-review-submit__file-group">
              <h3>{copy.cvResume}</h3>
              {draft.cv ? (
                <div className="application-review-submit__file-row">
                  <ApplicationFileIcon />
                  <span className="application-review-submit__file-copy">
                    <strong>{draft.cv.displayName}</strong>
                    <small>{fileMeta(draft.cv)}</small>
                  </span>
                  <span className="application-review-submit__source-pill">
                    {sourcePill()}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="application-review-submit__file-group">
              <h3>{copy.coverLetter}</h3>
              {draft.coverLetter?.kind === "FILE" ? (
                <div className="application-review-submit__file-row">
                  <ApplicationFileIcon />
                  <span className="application-review-submit__file-copy">
                    <strong>{draft.coverLetter.file.displayName}</strong>
                    <small>{fileMeta(draft.coverLetter.file)}</small>
                  </span>
                  <span className="application-review-submit__source-pill">
                    {copy.attachedFile}
                  </span>
                </div>
              ) : draft.coverLetter?.kind === "TEXT" ? (
                <div className="application-review-submit__cover-preview">
                  <span>{copy.coverLetter}</span>
                  <p>{draft.coverLetter.text}</p>
                </div>
              ) : (
                <p className="application-review-submit__empty-state">
                  {copy.noCoverLetter}
                </p>
              )}
            </div>
          </ReviewSummaryCard>

          <section className="application-review-submit__card">
            <label
              className="application-review-submit__textarea-label"
              htmlFor="application-message"
            >
              {copy.messageToRecruiter}
            </label>
            <textarea
              id="application-message"
              className="application-review-submit__textarea"
              rows={5}
              maxLength={2_000}
              value={message}
              placeholder={copy.messagePlaceholder}
              onChange={(event) => setMessage(event.target.value)}
              disabled={pending}
            />
          </section>

          <section className="application-review-submit__card application-review-submit__confirmation-card">
            <div className="application-review-submit__callout" role="note">
              <span className="application-review-submit__callout-icon">
                <ShieldCheck aria-hidden="true" />
              </span>
              <div>
                <h2>{copy.transparencyTitle}</h2>
                <p>{copy.transparencyDescription}</p>
                <div className="application-review-submit__callout-note">
                  <LockKeyhole aria-hidden="true" />
                  {copy.transparencySensitiveAttributes}
                </div>
              </div>
            </div>
            <label className="application-review-submit__confirm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={pending}
              />
              <span>{copy.confirmation}</span>
            </label>
            <label className="application-review-submit__confirm">
              <input
                type="checkbox"
                checked={shareContactWithRecruiter}
                onChange={(event) =>
                  setShareContactWithRecruiter(event.target.checked)
                }
              />
              <span>{copy.shareContact}</span>
            </label>
          </section>
        </div>

        <aside className="application-review-submit__sidebar">
          <section className="application-review-submit__card application-review-submit__job-card">
            <span className="application-review-submit__job-icon">
              <BriefcaseBusiness aria-hidden="true" />
            </span>
            <h2>{copy.jobSummary}</h2>
            <strong>{review.job.title}</strong>
            <p>{review.job.companyName}</p>
            <small>
              {review.job.location} ·{" "}
              {jobAttributeLabel(review.job.workArrangement, locale)}
            </small>
            {jobTags.length ? (
              <div className="application-review-submit__tags">
                {jobTags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="application-review-submit__card">
            <h2>{copy.filesToBeSubmitted}</h2>
            <ul className="application-review-submit__checklist">
              <li>
                <CheckCircle2 aria-hidden="true" />
                {copy.checklistPersonalInformation}
              </li>
              {draft.cv ? (
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  {copy.checklistCv(draft.cv.displayName)}
                </li>
              ) : null}
              {draft.coverLetter ? (
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  {copy.checklistCoverLetter}
                </li>
              ) : null}
              {hasMessage ? (
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  {copy.checklistMessage}
                </li>
              ) : null}
            </ul>
          </section>

          <section className="application-review-submit__after-submit">
            <h2>{copy.afterSubmission}</h2>
            <p>{copy.afterSubmissionDescription}</p>
            <small>{copy.afterSubmissionWithdrawal}</small>
          </section>
        </aside>
      </div>

      <footer className="application-review-submit__actions">
        <Link
          className="application-review-submit__button application-review-submit__button--secondary"
          href={filesHref}
        >
          <ArrowLeft aria-hidden="true" />
          {copy.backToFiles}
        </Link>
        <button
          type="button"
          className="application-review-submit__button application-review-submit__button--primary"
          disabled={pending}
          onClick={() => void submit()}
        >
          <Send aria-hidden="true" />
          {pending ? copy.submitting : copy.submit}
        </button>
      </footer>
    </main>
  );
}
