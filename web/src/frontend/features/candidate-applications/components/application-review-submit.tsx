"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Building2, Check, CheckCircle2, FileText, LockKeyhole, Save, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { applicationReceiptSchema, parseApplicationDraftResponse, type ApplicationFileDescriptor, type ApplicationReview } from "@/shared/contracts/candidate-applications";

function messageFrom(body: unknown, fallback: string) {
  return body && typeof body === "object" && !Array.isArray(body) && typeof (body as { message?: unknown }).message === "string" ? (body as { message: string }).message : fallback;
}

function fileSize(bytes: number) { return `${(bytes / 1_000_000).toFixed(bytes < 1_000_000 ? 1 : 0)} MB`; }
function pages(file: ApplicationFileDescriptor) { return file.mimeType === "application/pdf" ? "PDF" : file.mimeType.includes("word") ? "Document" : "File"; }
function label(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function dueDate(value: string | null) { return value ? `Due ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value))}` : null; }

function Stepper() {
  return <ol className="application-ui-stepper" aria-label="Application steps">
    {["Personal information", "Application files", "Review and submit"].map((label, index) => <li key={label} className={index < 2 ? "is-complete" : "is-active"}><span>{index < 2 ? <Check aria-hidden="true" /> : 3}</span><strong>{label}</strong></li>)}
  </ol>;
}

export function ApplicationReviewSubmit({ slug, review: initialReview, csrfProof }: { slug: string; review: ApplicationReview; csrfProof: string }) {
  const router = useRouter();
  const [review, setReview] = useState(initialReview);
  const [confirmed, setConfirmed] = useState(initialReview.draft.confirmationAccepted);
  const [message, setMessage] = useState(initialReview.draft.message ?? "");
  const [coverText, setCoverText] = useState(initialReview.draft.coverLetter?.kind === "TEXT" ? initialReview.draft.coverLetter.text : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitKey = useRef<string | null>(null);
  const draft = review.draft;

  async function save() {
    const response = await mutateWithCurrentCsrf("/api/candidate/application-drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: draft.jobId, expectedRevision: draft.revision, personalInformation: draft.personalInformation, cvVersionId: draft.cv?.versionId ?? null, coverLetter: draft.coverLetter?.kind === "TEXT" ? (coverText.trim() ? { kind: "TEXT", text: coverText } : null) : draft.coverLetter, message: message.trim() || null, confirmationAccepted: confirmed }) }, csrfProof);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(body, "The draft could not be updated."));
    const updated = parseApplicationDraftResponse(body);
    setReview(current => ({ ...current, draft: updated }));
    return updated;
  }
  async function saveDraft() { setPending(true); setError(null); try { await save(); } catch (caught) { setError(caught instanceof Error ? caught.message : "The draft could not be saved."); } finally { setPending(false); } }
  async function submit() {
    if (!confirmed || pending) return;
    setPending(true); setError(null);
    try { const updated = await save(); const idempotencyKey = submitKey.current ?? crypto.randomUUID(); submitKey.current = idempotencyKey; const response = await mutateWithCurrentCsrf("/api/candidate/applications", { method: "POST", headers: { "Content-Type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify({ draftId: updated.draftId, expectedRevision: updated.revision, informationConfirmed: true }) }, csrfProof); const body: unknown = await response.json().catch(() => null); if (!response.ok) throw new Error(messageFrom(body, "The application could not be submitted.")); const receipt = applicationReceiptSchema.parse(body); router.push(`/jobs/applied/${encodeURIComponent(receipt.applicationId)}/processing`); } catch (caught) { setError(caught instanceof Error ? caught.message : "The application could not be submitted."); } finally { setPending(false); }
  }
  const files = [draft.cv, draft.coverLetter?.kind === "FILE" ? draft.coverLetter.file : null].filter((file): file is ApplicationFileDescriptor => Boolean(file));
  return <main className="application-ui" aria-labelledby="application-review-title">
    <header className="application-ui__header"><div><nav className="application-ui__breadcrumb" aria-label="Breadcrumb"><Link href="/jobs">Jobs</Link><span>/</span><Link href={`/jobs/${encodeURIComponent(slug)}`}>{review.job.title}</Link><span>/</span><span>Apply</span></nav><h1 id="application-review-title">Apply – {review.job.title}</h1><p>Review your information and files before sending them to the recruiter.</p></div><button type="button" className="application-ui-button application-ui-button--secondary" onClick={() => void saveDraft()} disabled={pending}><Save aria-hidden="true" />{pending ? "Saving…" : "Save draft"}</button></header>
    <Stepper />
    {error ? <p className="application-ui-alert application-ui-alert--error" role="alert">{error}</p> : null}
    <div className="application-ui__columns"><div className="application-ui__main">
      <section className="application-ui-card"><h2>Personal information</h2><dl className="application-ui-personal"><div><dt>Full name</dt><dd>{draft.personalInformation.fullName}</dd></div><div><dt>Email</dt><dd>{draft.personalInformation.email}</dd></div><div><dt>Phone</dt><dd>{draft.personalInformation.phone}</dd></div></dl></section>
      <section className="application-ui-card"><div className="application-ui-card__heading"><h2>Application files</h2><Link href={`/jobs/${encodeURIComponent(slug)}/apply?step=2&draftId=${encodeURIComponent(draft.draftId)}`}>Change</Link></div><ul className="application-ui-file-list">{files.map(file => <li key={file.versionId}><span className="application-ui-file-icon"><FileText aria-hidden="true" /></span><span><strong>{file.displayName}</strong><small>{pages(file)} · {fileSize(file.byteSize)} · Read successfully</small></span><Link href={`/jobs/${encodeURIComponent(slug)}/apply?step=2&draftId=${encodeURIComponent(draft.draftId)}`}>Change</Link></li>)}</ul></section>
      {draft.coverLetter?.kind === "TEXT" ? <section className="application-ui-card"><label className="application-ui-textarea"><span><strong>Cover letter</strong><small>Optional</small></span><textarea rows={8} value={coverText} maxLength={10_000} onChange={event => setCoverText(event.target.value)} /></label></section> : null}
      <section className="application-ui-card"><label className="application-ui-textarea"><span><strong>Message to the recruiter</strong><small>Optional</small></span><textarea rows={5} value={message} maxLength={2_000} placeholder="Add a short message for the recruiter." onChange={event => setMessage(event.target.value)} /></label></section>
      <section className="application-ui-disclosure"><span className="application-ui-disclosure__icon"><ShieldCheck aria-hidden="true" /></span><div><h2>Transparency about automated support</h2><p>Recruiters may use automated tools to compare an application with job requirements. Scores, rankings, and internal notes are not shown to candidates and do not make the final hiring decision.</p><div className="application-ui-disclosure__private"><LockKeyhole aria-hidden="true" />Gender, age, marital status, and other sensitive personal attributes are excluded from automated assessment.</div></div></section>
      <label className="application-ui-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm that the information is correct and agree to send this application to the recruiter.</span></label>
    </div><aside className="application-ui__sidebar">
      <section className="application-ui-card application-ui-job-card"><Building2 aria-hidden="true" /><h2>{review.job.title}</h2><p>{review.job.companyName}</p><small>{review.job.location} · {label(review.job.workArrangement)}</small><div className="application-ui-tags"><span>{label(review.job.employmentType)}</span><span>{label(review.job.experienceLevel)}</span>{dueDate(review.job.applicationDeadline) ? <span>{dueDate(review.job.applicationDeadline)}</span> : null}</div></section>
      <section className="application-ui-card"><h2>Files to be submitted</h2><ul className="application-ui-check-list"><li><CheckCircle2 aria-hidden="true" />Personal information</li><li><CheckCircle2 aria-hidden="true" />CV {draft.cv ? `– ${draft.cv.displayName}` : ""}</li>{draft.coverLetter ? <li><CheckCircle2 aria-hidden="true" />Cover letter</li> : null}<li><CheckCircle2 aria-hidden="true" />Message to the recruiter</li></ul></section>
      <section className="application-ui-after-submit"><h2>After submission</h2><p>You will see the submission status and recruitment progress. AI scores, match scores, and rankings are not shown.</p><small>You can withdraw your application before the recruiter moves it to the interview stage.</small></section>
    </aside></div>
    <footer className="application-ui__footer"><Link className="application-ui-button application-ui-button--secondary" href={`/jobs/${encodeURIComponent(slug)}/apply?step=2&draftId=${encodeURIComponent(draft.draftId)}`}>Back to files</Link><button type="button" className="application-ui-button application-ui-button--primary" disabled={!confirmed || pending} onClick={() => void submit()}><Send aria-hidden="true" />{pending ? "Submitting…" : "Submit application"}</button></footer>
  </main>;
}
