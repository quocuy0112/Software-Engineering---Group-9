"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { ApplicationFiles } from "@/frontend/features/candidate-applications/components/application-files";
import {
  ApplicationPersonalInformation,
  isValidApplicationPhone,
  isValidApplicationUrl,
  type ApplicationWizardJob,
} from "@/frontend/features/candidate-applications/components/application-personal-information";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";
import {
  parseApplicationDraftResponse,
  type ApplicationDraft,
} from "@/shared/contracts/candidate-applications";
import {
  candidateCvSummarySchema,
  type CandidateCvSummary,
} from "@/shared/contracts/cv-import/candidate-cv";
import {
  validateCvFile,
  type CvFileValidationError,
} from "@/shared/cv-file-validation";

type WizardStep = 1 | 2;

function messageFrom(body: unknown, fallback: string) {
  return body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
    : fallback;
}

export function ApplicationWizard({
  slug,
  job,
  initialDraft,
  initialCvs,
  csrfProof,
  initialStep = 1,
  coverLetterNeedsReupload = false,
}: {
  slug: string;
  job: ApplicationWizardJob;
  initialDraft: ApplicationDraft;
  initialCvs: readonly CandidateCvSummary[];
  csrfProof: string;
  initialStep?: WizardStep;
  coverLetterNeedsReupload?: boolean;
}) {
  const router = useRouter();
  const copy = applicationCopy(useWorkspaceLocale());
  const [draft, setDraft] = useState(initialDraft);
  const [cvs, setCvs] = useState(() => [...initialCvs]);
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [selectedCvId, setSelectedCvId] = useState(
    initialDraft.cv?.versionId ?? "",
  );
  const [cvMode, setCvMode] = useState<"PROFILE" | "UPLOAD">(
    initialDraft.cvSource === "UPLOADED" ? "UPLOAD" : "PROFILE",
  );
  const [phone, setPhone] = useState(initialDraft.personalInformation.phone);
  const [currentLocation, setCurrentLocation] = useState(
    initialDraft.personalInformation.currentLocation,
  );
  const [linkedInPortfolio, setLinkedInPortfolio] = useState(
    initialDraft.personalInformation.linkedInPortfolio ?? "",
  );
  const [coverMode, setCoverMode] = useState<"TEXT" | "FILE">(
    initialDraft.coverLetter?.kind === "TEXT" ? "TEXT" : "FILE",
  );
  const [coverText, setCoverText] = useState(
    initialDraft.coverLetter?.kind === "TEXT"
      ? initialDraft.coverLetter.text
      : "",
  );
  // Preserve the existing optional submission message for older drafts. The
  // updated Step 2 presents cover-letter text through `coverLetter`, whose
  // discriminated contract guarantees one active text/file value.
  const [message] = useState(initialDraft.message ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    coverLetterNeedsReupload
      ? copy.applicationFiles.coverLetterNeedsReupload
      : null,
  );

  const personalInformation = {
    ...draft.personalInformation,
    phone,
    currentLocation,
    linkedInPortfolio: linkedInPortfolio.trim() || null,
  };

  function showFileUploadError(message: string) {
    setError(message);
    toast.error(message, { id: "candidate-cv-upload-error" });
  }

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
          cvSource: selectedCvId ? cvMode : null,
          coverLetter,
          message: message.trim() || null,
          confirmationAccepted: nextConfirmation,
        }),
      },
      csrfProof,
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(messageFrom(body, copy.applicationFiles.draftSaveError));
    const updated = parseApplicationDraftResponse(body);
    setDraft(updated);
    setSelectedCvId(updated.cv?.versionId ?? "");
    return updated;
  }

  async function continueToFiles() {
    setPending("continue");
    setError(null);
    try {
      if (!phone.trim())
        throw new Error(copy.personalInformation.phoneRequired);
      if (!isValidApplicationPhone(phone))
        throw new Error(copy.personalInformation.phoneInvalid);
      if (!currentLocation.trim())
        throw new Error(copy.personalInformation.locationRequired);
      if (!isValidApplicationUrl(linkedInPortfolio))
        throw new Error(copy.personalInformation.urlInvalid);
      await saveDraft();
      setStep(2);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : copy.personalInformation.draftSaveError,
      );
    } finally {
      setPending(null);
    }
  }

  async function continueToReview() {
    if (!selectedCvId) {
      setError(copy.applicationFiles.cvRequired);
      return;
    }
    setPending("review");
    setError(null);
    try {
      const updated = await saveDraft();
      router.push(
        `/jobs/${encodeURIComponent(slug)}/apply/review?draftId=${encodeURIComponent(updated.draftId)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : copy.applicationFiles.draftSaveError,
      );
    } finally {
      setPending(null);
    }
  }

  async function uploadCv(file: File) {
    try {
      await validateCvFile(file);
    } catch (caught) {
      const validation = caught as CvFileValidationError;
      showFileUploadError(
        validation?.message ??
          (file.size > 5_000_000
            ? copy.applicationFiles.cvFileSizeError
            : copy.applicationFiles.cvFileTypeError),
      );
      return;
    }
    setPending("cv");
    setError(null);
    try {
      // TODO(application-files): the existing direct application-CV endpoint
      // returns only a confirmed CandidateCv summary. It does not expose a
      // CV-import id, parser lifecycle, or retry action, so this UI cannot
      // truthfully render live parsing/failed states without that existing
      // pipeline projection being made available to Apply.
      const form = new FormData();
      form.append("file", file, file.name);
      const response = await mutateWithCurrentCsrf(
        "/api/account/candidate-cvs",
        { method: "POST", body: form },
        csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(messageFrom(body, copy.applicationFiles.cvUploadError));
      const saved = candidateCvSummarySchema.parse(body);
      setCvs((current) => [
        saved,
        ...current.filter((cv) => cv.id !== saved.id),
      ]);
      setSelectedCvId(saved.id);
      setCvMode("UPLOAD");
    } catch (caught) {
      showFileUploadError(
        caught instanceof Error
          ? caught.message
          : copy.applicationFiles.cvUploadError,
      );
    } finally {
      setPending(null);
    }
  }

  async function uploadCoverLetter(file: File) {
    try {
      await validateCvFile(file);
    } catch (caught) {
      const validation = caught as CvFileValidationError;
      showFileUploadError(
        validation?.message ??
          (file.size > 5_000_000
            ? copy.applicationFiles.coverFileSizeError
            : copy.applicationFiles.coverFileTypeError),
      );
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
      if (!response.ok)
        throw new Error(
          messageFrom(body, copy.applicationFiles.coverUploadError),
        );
      const updated = parseApplicationDraftResponse(body);
      setDraft(updated);
      setSelectedCvId(updated.cv?.versionId ?? selectedCvId);
      setCoverMode("FILE");
      setCoverText("");
    } catch (caught) {
      showFileUploadError(
        caught instanceof Error
          ? caught.message
          : copy.applicationFiles.coverUploadError,
      );
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
      setError(
        caught instanceof Error
          ? caught.message
          : copy.applicationFiles.draftSaveError,
      );
    } finally {
      setPending(null);
    }
  }

  function changeCvMode(mode: "PROFILE" | "UPLOAD") {
    setError(null);
    setCvMode(mode);
    if (mode === "UPLOAD") setSelectedCvId("");
  }

  function changeCoverMode(mode: "TEXT" | "FILE") {
    setError(null);
    setCoverMode(mode);
    if (mode === "TEXT") {
      if (draft.coverLetter?.kind === "FILE") {
        setDraft((current) => ({ ...current, coverLetter: null }));
      }
      return;
    }
    setCoverText("");
    if (draft.coverLetter?.kind === "TEXT") {
      setDraft((current) => ({ ...current, coverLetter: null }));
    }
  }

  function removeCoverLetter() {
    setError(null);
    setCoverText("");
    setDraft((current) => ({ ...current, coverLetter: null }));
  }

  if (step === 1) {
    return (
      <ApplicationPersonalInformation
        slug={slug}
        job={job}
        draft={draft}
        phone={phone}
        currentLocation={currentLocation}
        linkedInPortfolio={linkedInPortfolio}
        pending={pending}
        error={error}
        onPhoneChange={setPhone}
        onLocationChange={setCurrentLocation}
        onLinkedInPortfolioChange={setLinkedInPortfolio}
        onSaveDraft={() => void saveExplicitly()}
        onContinue={() => void continueToFiles()}
      />
    );
  }

  return (
    <ApplicationFiles
      slug={slug}
      job={job}
      draft={draft}
      cvs={cvs}
      selectedCvId={selectedCvId}
      cvMode={cvMode}
      coverMode={coverMode}
      coverText={coverText}
      pending={pending}
      error={error}
      onCvModeChange={changeCvMode}
      onCvSelectionChange={setSelectedCvId}
      onCvUpload={(file) => void uploadCv(file)}
      onCoverModeChange={changeCoverMode}
      onCoverTextChange={setCoverText}
      onCoverLetterUpload={(file) => void uploadCoverLetter(file)}
      onCoverLetterRemove={removeCoverLetter}
      onBack={() => setStep(1)}
      onSaveDraft={() => void saveExplicitly()}
      onContinue={() => void continueToReview()}
    />
  );
}
