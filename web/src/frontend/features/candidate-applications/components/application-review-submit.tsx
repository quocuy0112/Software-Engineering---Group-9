"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  applicationReceiptSchema,
  parseApplicationDraftResponse,
  type ApplicationReview,
} from "@/shared/contracts/candidate-applications";

function messageFrom(body: unknown, fallback: string) {
  return body && typeof body === "object" && !Array.isArray(body) &&
    typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
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
  const [review, setReview] = useState(initialReview);
  const [confirmed, setConfirmed] = useState(initialReview.draft.confirmationAccepted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitKey = useRef<string | null>(null);

  async function saveConfirmation() {
    const draft = review.draft;
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
          coverLetter: draft.coverLetter,
          message: draft.message,
          confirmationAccepted: confirmed,
        }),
      },
      csrfProof,
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(body, "The draft could not be updated."));
    const updated = parseApplicationDraftResponse(body);
    setReview((current) => ({ ...current, draft: updated }));
    return updated;
  }

  async function submit() {
    if (!confirmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const draft = await saveConfirmation();
      const idempotencyKey = submitKey.current ?? crypto.randomUUID();
      submitKey.current = idempotencyKey;
      const response = await mutateWithCurrentCsrf(
        "/api/candidate/applications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "idempotency-key": idempotencyKey },
          body: JSON.stringify({
            draftId: draft.draftId,
            expectedRevision: draft.revision,
            informationConfirmed: true,
          }),
        },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(body, "The application could not be submitted."));
      const receipt = applicationReceiptSchema.parse(body);
      router.push(`/jobs/applied/${encodeURIComponent(receipt.applicationId)}/processing`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The application could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  const draft = review.draft;
  return (
    <section className="candidate-application-flow" aria-labelledby="application-review-title">
      <header className="candidate-application-flow__header">
        <div>
          <p className="workspace-kicker">Step 3</p>
          <h1 id="application-review-title">Review and submit</h1>
          <p>{review.job.title} · {review.job.companyName}</p>
        </div>
        <Link href={`/jobs/${encodeURIComponent(slug)}/apply`} className="job-secondary-link">Save and exit</Link>
      </header>
      <ol className="candidate-application-steps" aria-label="Application steps">
        <li className="is-complete">1. Personal information</li>
        <li className="is-complete">2. Application files</li>
        <li className="is-active">3. Review and submit</li>
      </ol>
      {error ? <p className="candidate-application-error" role="alert">{error}</p> : null}

      <div className="candidate-application-review-grid">
        <section className="candidate-application-panel" aria-labelledby="review-information-heading">
          <div className="candidate-application-panel-heading"><div><p className="workspace-kicker">Personal information</p><h2 id="review-information-heading">Your profile details</h2></div><Link href={`/jobs/${encodeURIComponent(slug)}/apply?step=1&draftId=${encodeURIComponent(draft.draftId)}`}>Change</Link></div>
          <dl className="candidate-application-details">
            <div><dt>Full name</dt><dd>{draft.personalInformation.fullName}</dd></div>
            <div><dt>Email</dt><dd>{draft.personalInformation.email}</dd></div>
            <div><dt>Phone</dt><dd>{draft.personalInformation.phone || "Not added"}</dd></div>
          </dl>
        </section>

        <section className="candidate-application-panel" aria-labelledby="review-files-heading">
          <div className="candidate-application-panel-heading"><div><p className="workspace-kicker">Application files</p><h2 id="review-files-heading">What will be shared</h2></div><Link href={`/jobs/${encodeURIComponent(slug)}/apply?step=2&draftId=${encodeURIComponent(draft.draftId)}`}>Change</Link></div>
          <dl className="candidate-application-details">
            <div><dt>CV</dt><dd>{draft.cv?.displayName ?? "No CV selected"}</dd></div>
            <div><dt>Cover letter</dt><dd>{draft.coverLetter ? draft.coverLetter.kind === "TEXT" ? "Typed cover letter" : draft.coverLetter.file.displayName : "Not included"}</dd></div>
            <div><dt>Message</dt><dd>{draft.message || "Not included"}</dd></div>
          </dl>
        </section>

        <aside className="candidate-application-panel candidate-application-panel--quiet"><p className="workspace-kicker">Transparency about automated support</p><h2>How SmartHire may help</h2><p>Recruiters may use automated comparison support as part of their review. This support is applied uniformly and disclosed to candidates; it does not change what you share in this application.</p></aside>
      </div>

      <label className="candidate-application-confirmation"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> <span>I confirm that these application details are accurate and that I want to share this application with the hiring company.</span></label>
      <footer className="candidate-application-actions"><Link href={`/jobs/${encodeURIComponent(slug)}/apply?step=2&draftId=${encodeURIComponent(draft.draftId)}`} className="job-secondary-button">Back</Link><button type="button" className="sh-button" disabled={!confirmed || pending} onClick={() => void submit()}>{pending ? "Submitting…" : "Submit application"}</button></footer>
    </section>
  );
}
