"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import {
  parseApplicationDraftResponse,
  type ApplicationDraft,
} from "@/shared/contracts/candidate-applications";
import {
  candidateCvSummarySchema,
  type CandidateCvSummary,
} from "@/shared/contracts/cv-import/candidate-cv";

type WizardStep = 1 | 2;

function messageFrom(body: unknown, fallback: string) {
  return body && typeof body === "object" && !Array.isArray(body) &&
    typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
    : fallback;
}

function fileType(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return file.type;
}

export function ApplicationWizard({
  slug,
  job,
  initialDraft,
  initialCvs,
  csrfProof,
  initialStep = 1,
}: {
  slug: string;
  job: { id: string; title: string; companyName: string; location: string };
  initialDraft: ApplicationDraft;
  initialCvs: readonly CandidateCvSummary[];
  csrfProof: string;
  initialStep?: WizardStep;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [cvs, setCvs] = useState(() => [...initialCvs]);
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [selectedCvId, setSelectedCvId] = useState(initialDraft.cv?.versionId ?? "");
  const [cvMode, setCvMode] = useState<"PROFILE" | "UPLOAD">(
    initialDraft.cv ? "PROFILE" : "UPLOAD",
  );
  const [phone, setPhone] = useState(initialDraft.personalInformation.phone);
  const [coverMode, setCoverMode] = useState<"TEXT" | "FILE">(
    initialDraft.coverLetter?.kind === "FILE" ? "FILE" : "TEXT",
  );
  const [coverText, setCoverText] = useState(
    initialDraft.coverLetter?.kind === "TEXT" ? initialDraft.coverLetter.text : "",
  );
  const [message, setMessage] = useState(initialDraft.message ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const personalInformation = { ...draft.personalInformation, phone };
  const selectedCv = cvs.find((cv) => cv.id === selectedCvId) ?? null;
  const profilePhoneMissing = !personalInformation.phone.trim();

  async function saveDraft(nextConfirmation = draft.confirmationAccepted) {
    const coverLetter =
      coverMode === "TEXT"
        ? coverText.trim()
          ? { kind: "TEXT" as const, text: coverText }
          : null
        : draft.coverLetter?.kind === "FILE"
          ? draft.coverLetter
          : null;
    const response = await mutateWithCurrentCsrf(
      "/api/candidate/application-drafts",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          expectedRevision: draft.revision,
          personalInformation,
          cvVersionId: selectedCvId || null,
          coverLetter,
          message: message.trim() || null,
          confirmationAccepted: nextConfirmation,
        }),
      },
      csrfProof,
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(messageFrom(body, "The draft could not be saved."));
    const updated = parseApplicationDraftResponse(body);
    setDraft(updated);
    setSelectedCvId(updated.cv?.versionId ?? "");
    return updated;
  }

  async function continueToFiles() {
    setPending("continue");
    setError(null);
    try {
      await saveDraft();
      setStep(2);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be saved.");
    } finally {
      setPending(null);
    }
  }

  async function continueToReview() {
    setPending("review");
    setError(null);
    try {
      const updated = await saveDraft();
      router.push(`/jobs/${encodeURIComponent(slug)}/apply/review?draftId=${encodeURIComponent(updated.draftId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be saved.");
    } finally {
      setPending(null);
    }
  }

  async function uploadCv(file: File) {
    if (file.size < 1 || file.size > 5_000_000) {
      setError("CV files must be between 1 byte and 5 MB.");
      return;
    }
    const mime = fileType(file);
    if (![
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ].includes(mime)) {
      setError("Choose a PDF, DOC, or DOCX file.");
      return;
    }
    setPending("cv");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const response = await mutateWithCurrentCsrf(
        "/api/account/candidate-cvs",
        { method: "POST", body: form },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(body, "The CV could not be uploaded."));
      const saved = candidateCvSummarySchema.parse(body);
      setCvs((current) => [saved, ...current.filter((cv) => cv.id !== saved.id)]);
      setSelectedCvId(saved.id);
      setCvMode("UPLOAD");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The CV could not be uploaded.");
    } finally {
      setPending(null);
    }
  }

  async function uploadCoverLetter(file: File) {
    if (file.size < 1 || file.size > 5_000_000) {
      setError("Cover letters must be between 1 byte and 5 MB.");
      return;
    }
    if (!["pdf", "doc", "docx"].includes(file.name.toLowerCase().split(".").pop() ?? "")) {
      setError("Choose a PDF, DOC, or DOCX cover letter.");
      return;
    }
    setPending("cover");
    setError(null);
    try {
      const form = new FormData();
      form.append("draftId", draft.draftId);
      form.append("expectedRevision", String(draft.revision));
      form.append("file", file, file.name);
      const response = await mutateWithCurrentCsrf(
        "/api/candidate/application-drafts/cover-letter",
        { method: "POST", body: form },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(messageFrom(body, "The cover letter could not be uploaded."));
      const updated = parseApplicationDraftResponse(body);
      setDraft(updated);
      setSelectedCvId(updated.cv?.versionId ?? selectedCvId);
      setCoverMode("FILE");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The cover letter could not be uploaded.");
    } finally {
      setPending(null);
    }
  }

  async function saveExplicitly() {
    setPending("save");
    setError(null);
    try {
      await saveDraft();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft could not be saved.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="candidate-application-flow" aria-labelledby="application-flow-title">
      <header className="candidate-application-flow__header">
        <div>
          <nav className="application-ui__breadcrumb" aria-label="Breadcrumb"><Link href="/jobs">Jobs</Link><span>/</span><Link href={`/jobs/${encodeURIComponent(slug)}`}>{job.title}</Link><span>/</span><span>Apply</span></nav>
          <h1 id="application-flow-title">Apply – {job.title}</h1>
          <p>Complete your information and files before reviewing your application.</p>
        </div>
        <Link href="/jobs" className="job-secondary-link">Back to jobs</Link>
      </header>

      <ol className="candidate-application-steps" aria-label="Application steps">
        <li className={step === 1 ? "is-active" : "is-complete"}>1. Personal information</li>
        <li className={step === 2 ? "is-active" : undefined}>2. Application files</li>
        <li>3. Review and submit</li>
      </ol>

      {error ? <p className="candidate-application-error" role="alert">{error}</p> : null}

      {step === 1 ? (
        <div className="candidate-application-grid">
          <section className="candidate-application-panel" aria-labelledby="personal-information-title">
            <p className="workspace-kicker">Step 1</p>
            <h2 id="personal-information-title">Personal information</h2>
            <p className="candidate-application-muted">
              Your name and email come from your Profile. If your Profile has no phone number, add one for this application.
            </p>
            <dl className="candidate-application-details">
              <div><dt>Full name</dt><dd>{personalInformation.fullName}</dd></div>
              <div><dt>Email</dt><dd>{personalInformation.email}</dd></div>
              {initialDraft.personalInformation.phone.trim() ? (
                <div><dt>Phone</dt><dd>{personalInformation.phone}</dd></div>
              ) : (
                <div>
                  <dt>Phone <strong aria-hidden="true">*</strong></dt>
                  <dd>
                  <input
                    type="tel"
                    value={phone}
                    maxLength={20}
                    autoComplete="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Enter your phone number"
                    disabled={pending !== null}
                    required
                    aria-label="Phone"
                  />
                  </dd>
                </div>
              )}
            </dl>
            {profilePhoneMissing ? (
              <p className="candidate-application-warning" role="status">
                Add a phone number here before submitting this application. This value is saved for this application; your Profile is unchanged.
              </p>
            ) : null}
            <p className="candidate-application-muted">Your name and email come from your Profile. Update your Profile if you want to change them for future applications.</p>
          </section>
          <aside className="candidate-application-panel candidate-application-panel--quiet">
            <p className="workspace-kicker">Privacy</p>
            <h2>What gets shared</h2>
            <p>Your selected CV, optional cover letter, profile contact snapshot, and messages are shared with the hiring company for this application.</p>
            <p>SmartHire may use automated support uniformly across applications. This is disclosed to candidates and is not an application-by-application opt-in.</p>
          </aside>
        </div>
      ) : (
        <div className="candidate-application-grid">
          <section className="candidate-application-panel" aria-labelledby="application-files-title">
            <p className="workspace-kicker">Step 2</p>
            <h2 id="application-files-title">Application files</h2>
            <fieldset className="candidate-application-cover">
              <legend>CV <span aria-hidden="true">*</span></legend>
              <div className="candidate-application-choice-row">
                <label><input type="radio" name="cv-kind" checked={cvMode === "PROFILE"} onChange={() => setCvMode("PROFILE")} />Choose from your profile</label>
                <label><input type="radio" name="cv-kind" checked={cvMode === "UPLOAD"} onChange={() => { setCvMode("UPLOAD"); setSelectedCvId(""); }} />Upload a new file</label>
              </div>
              {cvMode === "PROFILE" ? <label className="candidate-application-field"><span>Confirmed CVs</span><select value={selectedCvId} onChange={(event) => setSelectedCvId(event.target.value)} disabled={pending !== null} required><option value="">Choose a confirmed CV</option>{cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.displayName} ({cv.fileName}) · updated {new Date(cv.confirmedAt).toLocaleDateString()}</option>)}</select></label> : <label className="candidate-application-upload"><span>Drag a file here or click to choose</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCv(file); event.currentTarget.value = ""; }} disabled={pending !== null} /><small>PDF, DOC, or DOCX · maximum 5 MB</small></label>}
            </fieldset>
            {selectedCv ? <p className="candidate-application-file-note">Selected: {selectedCv.displayName} · confirmed {new Date(selectedCv.confirmedAt).toLocaleDateString()}</p> : null}

            <fieldset className="candidate-application-cover">
              <legend>Cover letter <span>(optional)</span></legend>
              <div className="candidate-application-choice-row">
                <label><input type="radio" name="cover-letter-kind" checked={coverMode === "TEXT"} onChange={() => { setCoverMode("TEXT"); if (draft.coverLetter?.kind === "FILE") setDraft((current) => ({ ...current, coverLetter: null })); }} />Write inline</label>
                <label><input type="radio" name="cover-letter-kind" checked={coverMode === "FILE"} onChange={() => { setCoverMode("FILE"); setCoverText(""); if (draft.coverLetter?.kind === "TEXT") setDraft((current) => ({ ...current, coverLetter: null })); }} />Upload a file</label>
              </div>
              {coverMode === "TEXT" ? (
                <textarea value={coverText} maxLength={10_000} rows={8} onChange={(event) => setCoverText(event.target.value)} placeholder="Tell the recruiter why this role interests you." />
              ) : (
                <>
                  <label className="candidate-application-upload"><span>Drag a file here or click to choose</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCoverLetter(file); event.currentTarget.value = ""; }} disabled={pending !== null} /><small>PDF, DOC, or DOCX · maximum 5 MB</small></label>
                  {draft.coverLetter?.kind === "FILE" ? <p className="candidate-application-file-note">Selected: {draft.coverLetter.file.displayName}</p> : <p className="candidate-application-muted">No cover letter file selected.</p>}
                </>
              )}
            </fieldset>

            <label className="candidate-application-field"><span>Message to the recruiter <span>(optional)</span></span><textarea value={message} maxLength={2_000} rows={5} onChange={(event) => setMessage(event.target.value)} placeholder="Add a short message for the recruiter." /></label>
          </section>
          <aside className="candidate-application-panel candidate-application-panel--quiet"><p className="workspace-kicker">File checks</p><h2>Before you submit</h2><p>Profile CVs must be confirmed, owned by you, readable, and within the supported file limits. Your chosen files are checked again at submission and during technical intake.</p></aside>
        </div>
      )}

      <footer className="candidate-application-actions">
        {step === 2 ? <button type="button" className="job-secondary-button" onClick={() => setStep(1)} disabled={pending !== null}>Back</button> : null}
        <button type="button" className="job-secondary-button" onClick={() => void saveExplicitly()} disabled={pending !== null}>{pending === "save" ? "Saving…" : "Save draft"}</button>
        {step === 1 ? <button type="button" className="sh-button" onClick={() => void continueToFiles()} disabled={pending !== null}>{pending === "continue" ? "Saving…" : "Continue to files"}</button> : <button type="button" className="sh-button" onClick={() => void continueToReview()} disabled={pending !== null || !selectedCvId}>{pending === "review" ? "Saving…" : "Review and submit"}</button>}
      </footer>
    </section>
  );
}
