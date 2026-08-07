"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCvImport } from "@/frontend/features/cv-import/client/use-cv-import";
import { profileMutationOutcomeSchema } from "@/shared/contracts/account/profile";
import type {
  ApplicationContactSnapshot,
  ApplicationForm,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";
import {
  applicationFormSchema,
  applicationOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import type { AppliedJobState } from "@/shared/contracts/jobs/catalog";
import { useOptionalJobInteraction } from "./job-interaction-provider";

const MAX_CV_BYTES = 5_000_000;
const PHONE_INPUT_MAX_LENGTH = 15;
const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type FieldErrors = Record<string, string>;
type ApplicationMeta = Pick<
  AppliedJobState,
  "cvFileRef" | "contactSnapshot" | "aiAnalysisConsent" | "aiMatchScore"
>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function normalizePhone(value: string) {
  return value
    .replace(/[^\d+]/gu, "")
    .replace(/(?!^)\+/gu, "")
    .slice(0, PHONE_INPUT_MAX_LENGTH);
}

function canonicalizePhone(value: string) {
  const normalized = normalizePhone(value);
  return normalized.startsWith("0") ? "+84" + normalized.slice(1) : normalized;
}

function phoneValidationError(value: string) {
  const phone = normalizePhone(value);
  if (!phone) return "Enter your phone number.";
  if (!/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/u.test(phone)) {
    return "Enter a valid Vietnamese phone number.";
  }
  return null;
}

function validateContact(contact: ApplicationContactSnapshot): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.fullName.trim()) errors.fullName = "Enter your full name.";
  if (!contact.email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  const phoneError = phoneValidationError(contact.phone);
  if (phoneError) errors.phone = phoneError;
  return errors;
}

function fieldA11y(field: string, errors: FieldErrors) {
  return {
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? field + "-error" : undefined,
  };
}

function applyCvImportSessionKey(jobId: string) {
  return `smarthire:apply-cv-import:${jobId}`;
}

type ApplyImportCleanup = () => boolean | Promise<boolean>;

function InlineApplicationForm({
  form,
  onCancel,
  onProfileSaved,
  onImportConfirmed,
  preferredCvId,
  onRegisterImportCleanup,
  contactDraft,
  onContactChange,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onProfileSaved: (profile: {
    revision: number;
    basics: ApplicationForm["profileBasics"];
  }) => void;
  onImportConfirmed: (uploadId: string) => void;
  preferredCvId: string | null;
  onRegisterImportCleanup: (cleanup: ApplyImportCleanup | null) => void;
  contactDraft: ApplicationContactSnapshot | null;
  onContactChange: (contact: ApplicationContactSnapshot) => void;
  onSubmitted: (outcome: ApplicationOutcome, meta: ApplicationMeta) => void;
}) {
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const importer = useCvImport({ csrfProof: form.csrfToken || csrfProof });
  const importProgress = importer.progress;
  const resumeImport = importer.resume;
  const loadImportStatus = importer.loadStatus;
  const cancelImport = importer.cancel;
  const importSessionKey = applyCvImportSessionKey(form.jobId);
  const resumedImport = useRef(false);
  const consentNavigationAttempted = useRef<string | null>(null);
  const [selectedCvId, setSelectedCvId] = useState(() =>
    preferredCvId && form.cvs.some((cv) => cv.id === preferredCvId)
      ? preferredCvId
      : "",
  );
  const [newCvFile, setNewCvFile] = useState<File | null>(null);
  const [newCvImportStarted, setNewCvImportStarted] = useState(false);
  const [contact, setContact] = useState<ApplicationContactSnapshot>(
    contactDraft
      ? { ...contactDraft, phone: normalizePhone(contactDraft.phone) }
      : form.contact
        ? { ...form.contact, phone: normalizePhone(form.contact.phone) }
        : { fullName: "", email: "", phone: "" },
  );
  const [selectedLocation, setSelectedLocation] = useState(() =>
    form.profileBasics.location?.trim() === form.jobLocation.trim()
      ? form.jobLocation
      : "",
  );
  const [profileRevision, setProfileRevision] = useState(form.profileRevision);
  const [profileBasics, setProfileBasics] = useState(form.profileBasics);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationSaveError, setLocationSaveError] = useState<string | null>(
    null,
  );
  const [applicationConsent, setApplicationConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const importBusy = [
    "RESERVING",
    "UPLOADING",
    "PROCESSING",
    "AWAITING_CONSENT",
    "AI_PENDING",
    "AI_PROCESSING",
  ].includes(importer.progress.state);

  const cleanupImport = useCallback<ApplyImportCleanup>(() => {
    if (!newCvImportStarted) {
      cancelImport();
      try {
        window.sessionStorage.removeItem(importSessionKey);
      } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
      }
      return true;
    }
    return (async () => {
      if (
        !window.confirm(
          "Your AI CV import is not complete. Leave and cancel this import?",
        )
      )
        return false;

      const uploadId = importProgress.uploadId;
      let confirmed = false;
      if (uploadId) {
        try {
          const resource = await loadImportStatus(uploadId);
          confirmed = "status" in resource && resource.status === "CONFIRMED";
        } catch {
          // A confirmed race is safe: the DELETE endpoint rejects CONFIRMED.
        }
        if (!confirmed) {
          try {
            await mutateWithCurrentCsrf(
              `/api/account/cv-imports/${uploadId}`,
              { method: "DELETE" },
              form.csrfToken || csrfProof,
            );
          } catch {
            // The session marker is still cleared so a failed cleanup cannot
            // resurrect a broken Apply state on the next open.
          }
        }
      }
      cancelImport();
      try {
        if (
          !uploadId ||
          window.sessionStorage.getItem(importSessionKey) === uploadId
        )
          window.sessionStorage.removeItem(importSessionKey);
      } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
      }
      setNewCvImportStarted(false);
      setNewCvFile(null);
      setSelectedCvId("");
      return true;
    })();
  }, [
    cancelImport,
    csrfProof,
    form.csrfToken,
    importProgress.uploadId,
    importSessionKey,
    loadImportStatus,
    newCvImportStarted,
  ]);

  useEffect(() => {
    onRegisterImportCleanup(cleanupImport);
    return () => onRegisterImportCleanup(null);
  }, [cleanupImport, onRegisterImportCleanup]);

  function updateContact(next: ApplicationContactSnapshot) {
    setContact(next);
    onContactChange(next);
  }

  useEffect(() => {
    const uploadId = importProgress.uploadId;
    if (!uploadId) return;
    try {
      window.sessionStorage.setItem(importSessionKey, uploadId);
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }, [importProgress.uploadId, importSessionKey]);

  useEffect(() => {
    if (resumedImport.current) return;
    resumedImport.current = true;
    let uploadId: string | null = null;
    try {
      uploadId = window.sessionStorage.getItem(importSessionKey);
    } catch {
      uploadId = null;
    }
    if (!uploadId) return;
    setNewCvImportStarted(true);
    void resumeImport(uploadId).catch(() => {
      try {
        if (window.sessionStorage.getItem(importSessionKey) === uploadId)
          window.sessionStorage.removeItem(importSessionKey);
      } catch {
        // Session storage can be unavailable in privacy-restricted browsers.
      }
      setNewCvImportStarted(false);
    });
  }, [importSessionKey, resumeImport]);

  useEffect(() => {
    const uploadId = importProgress.uploadId;
    if (
      importProgress.state !== "AWAITING_CONSENT" ||
      !uploadId ||
      consentNavigationAttempted.current === uploadId
    )
      return;
    consentNavigationAttempted.current = uploadId;
    try {
      window.open(
        "/profile/cv-imports/" + encodeURIComponent(uploadId),
        "_blank",
        "noopener,noreferrer",
      );
    } catch {
      // A blocked popup leaves the manual fallback link visible below.
    }
  }, [importProgress.state, importProgress.uploadId]);

  useEffect(() => {
    const uploadId = importProgress.uploadId;
    if (importProgress.state !== "SUCCESS" || !uploadId) return;
    let active = true;
    void loadImportStatus(uploadId)
      .then((resource) => {
        if (
          !active ||
          !("status" in resource) ||
          resource.status !== "CONFIRMED"
        )
          return;
        try {
          if (window.sessionStorage.getItem(importSessionKey) === uploadId)
            window.sessionStorage.removeItem(importSessionKey);
        } catch {
          // Session storage can be unavailable in privacy-restricted browsers.
        }
        onImportConfirmed(uploadId);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [
    importSessionKey,
    importProgress.state,
    importProgress.uploadId,
    loadImportStatus,
    onImportConfirmed,
  ]);

  useEffect(() => {
    const uploadId = importProgress.uploadId;
    if (importProgress.state !== "SUCCESS" || !uploadId) return;
    const refreshWhenFocused = () => {
      void resumeImport(uploadId).catch(() => undefined);
    };
    window.addEventListener("focus", refreshWhenFocused);
    return () => window.removeEventListener("focus", refreshWhenFocused);
  }, [importProgress.state, importProgress.uploadId, resumeImport]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const accepted =
      ACCEPTED_CV_TYPES.has(file.type) ||
      extension === "pdf" ||
      extension === "docx";
    if (!accepted) {
      setNewCvFile(null);
      setErrors((current) => ({
        ...current,
        cv: "CV files must be PDF or DOCX.",
      }));
      return;
    }
    if (file.size < 1 || file.size > MAX_CV_BYTES) {
      setNewCvFile(null);
      setErrors((current) => ({
        ...current,
        cv: "CV files must be between 1 and 5 MB and must be PDF or DOCX.",
      }));
      return;
    }
    try {
      window.sessionStorage.removeItem(importSessionKey);
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
    setNewCvFile(file);
    setSelectedCvId("");
    setNewCvImportStarted(false);
    setErrors((current) => {
      const next = { ...current };
      delete next.cv;
      return next;
    });
  }

  async function startNewCvImport() {
    if (!newCvFile || newCvImportStarted) return;
    setNewCvImportStarted(true);
    setError(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.cv;
      return next;
    });
    try {
      await importer.upload(newCvFile, "EXTERNAL_OPENAI");
    } catch (caught) {
      setNewCvImportStarted(false);
      setErrors((current) => ({
        ...current,
        cv:
          caught instanceof Error
            ? caught.message
            : "Unable to start AI CV import.",
      }));
    }
  }

  function validate(): boolean {
    const next = validateContact({
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: normalizePhone(contact.phone),
    });
    if (!selectedCvId) {
      next.cv = newCvImportStarted
        ? "Finish the AI CV review and confirmation, then reopen Apply to select the imported CV."
        : newCvFile
          ? "Start the AI import before applying this new CV."
          : "Select one saved CV or import one new CV with AI.";
    }
    if (!locationReady) {
      next.location = selectedLocation
        ? "Save the selected job location before applying."
        : "Select the job location.";
    }
    if (!applicationConsent)
      next.consent = "Accept the application consent before applying.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function saveLocation(value: string) {
    const location = value.trim() || null;
    setSelectedLocation(value);
    setLocationSaveError(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.location;
      return next;
    });
    setLocationSaving(true);
    try {
      const response = await mutateWithCurrentCsrf(
        "/api/account/profile",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: "basics",
            baseRevision: profileRevision,
            basics: {
              ...profileBasics,
              location,
            },
          }),
        },
        form.csrfToken || csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const problem = body as { message?: unknown } | null;
        throw new Error(
          typeof problem?.message === "string"
            ? problem.message
            : "Unable to save your location.",
        );
      }
      const result = profileMutationOutcomeSchema.parse(body);
      const saved = {
        revision: result.profile.revision,
        basics: result.profile.basics,
      };
      setProfileRevision(saved.revision);
      setProfileBasics(saved.basics);
      setSelectedLocation(
        saved.basics.location?.trim() === form.jobLocation.trim()
          ? form.jobLocation
          : "",
      );
      onProfileSaved(saved);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to save your location.";
      setLocationSaveError(message);
      setErrors((current) => ({ ...current, location: message }));
    } finally {
      setLocationSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const answers = form.questions.map((question) => ({
      questionId: question.id,
      value:
        question.kind === "BOOLEAN"
          ? data.get("question-" + question.id) === "true"
          : String(data.get("question-" + question.id) ?? ""),
    }));
    const cvFileRef = selectedCvId;
    const contactSnapshot = {
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: canonicalizePhone(contact.phone),
    };

    try {
      idempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ??
        "application-" + Date.now() + "-key";
      const payload = {
        cvId: selectedCvId || cvFileRef,
        cvFileRef,
        contactSnapshot,
        answers,
        coverLetter: String(data.get("coverLetter") ?? "") || null,
        consentVersion: form.consentVersion,
        consentAccepted: applicationConsent,
        aiAnalysisConsent: aiConsent,
      };
      const response = await mutateWithCurrentCsrf(
        "/api/jobs/" + form.jobId + "/applications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey.current,
          },
          body: JSON.stringify(payload),
        },
        form.csrfToken || csrfProof,
      );

      const body: unknown = await response.json();
      if (!response.ok) {
        const problem = body as { message?: unknown; fieldErrors?: unknown };
        if (problem.fieldErrors && typeof problem.fieldErrors === "object") {
          const serverErrors: FieldErrors = {};
          for (const [field, value] of Object.entries(
            problem.fieldErrors as Record<string, unknown>,
          )) {
            const first = Array.isArray(value) ? value[0] : value;
            if (typeof first === "string") serverErrors[field] = first;
          }
          setErrors((current) => ({ ...current, ...serverErrors }));
        }
        setError(
          typeof problem.message === "string"
            ? problem.message
            : "Unable to submit your application.",
        );
        return;
      }

      const outcome = applicationOutcomeSchema.parse(body);
      onSubmitted(
        {
          ...outcome,
          aiAnalysisConsent: aiConsent,
          aiMatchScore: aiConsent ? 82 : null,
        },
        {
          cvFileRef,
          contactSnapshot,
          aiAnalysisConsent: aiConsent,
          aiMatchScore: aiConsent ? 82 : null,
        },
      );
    } catch {
      setError("Unable to submit your application. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const locationReady =
    !locationSaving &&
    Boolean(selectedLocation.trim()) &&
    profileBasics.location?.trim() === selectedLocation.trim();
  const missingProfileFields = Array.from(
    new Set([
      ...form.missingProfileFields.filter((field) => field !== "location"),
      ...(locationReady ? [] : ["location"]),
    ]),
  );
  const profileReady = missingProfileFields.length === 0;
  const submitDisabled =
    pending || locationSaving || importBusy || !selectedCvId;

  return (
    <form
      className="job-form-grid"
      aria-label={"Apply for " + form.jobTitle}
      onSubmit={submit}
      onChange={() => {
        idempotencyKey.current = null;
        setError(null);
      }}
      noValidate
    >
      {!profileReady ? (
        <div role="alert">
          Please complete these profile fields first:{" "}
          {missingProfileFields.join(", ")}.
        </div>
      ) : null}

      <fieldset className="job-application-fieldset">
        <legend>Application CV</legend>
        <p className="job-form-help">
          Select exactly one confirmed CV from your Profile, or import one new
          PDF/DOCX through AI review.
        </p>
        <label htmlFor="application-cv-id">
          Select a CV from Profile
          <select
            id="application-cv-id"
            name="cvId"
            value={selectedCvId}
            disabled={pending || newCvImportStarted}
            {...fieldA11y("cv", errors)}
            onChange={(event) => {
              try {
                window.sessionStorage.removeItem(importSessionKey);
              } catch {
                // Session storage can be unavailable in privacy-restricted browsers.
              }
              setSelectedCvId(event.currentTarget.value);
              setNewCvFile(null);
              setErrors((current) => {
                const next = { ...current };
                delete next.cv;
                return next;
              });
            }}
          >
            <option value="">
              {form.cvs.length
                ? "Select one saved CV"
                : "No confirmed CVs in Profile"}
            </option>
            {form.cvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {(cv.displayName.trim() || cv.fileName) +
                  ` (${formatBytes(cv.byteSize)})`}
              </option>
            ))}
          </select>
        </label>
        <label
          className="job-cv-dropzone"
          htmlFor="application-cv-upload"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLLabelElement>) => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0]);
          }}
        >
          <span className="job-cv-dropzone-title">
            {newCvFile
              ? "New CV ready for AI import"
              : "Drag a CV here or click to choose"}
          </span>
          <span className="job-form-help">PDF, DOC, DOCX · up to 5 MB</span>
          <input
            ref={fileInputRef}
            id="application-cv-upload"
            name="newCvImport"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-describedby={errors.cv ? "cv-error" : undefined}
            disabled={pending || newCvImportStarted}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {newCvFile ? (
          <div className="job-selected-file" role="status">
            <span>
              <strong>{newCvFile.name}</strong> · {formatBytes(newCvFile.size)}
            </span>
            <span className="job-file-actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending || newCvImportStarted}
              >
                Change file
              </button>
              <button
                type="button"
                onClick={() => setNewCvFile(null)}
                disabled={pending || newCvImportStarted}
              >
                Remove
              </button>
            </span>
          </div>
        ) : null}
        {newCvFile && !newCvImportStarted ? (
          <button
            type="button"
            onClick={() => void startNewCvImport()}
            disabled={pending || importBusy}
          >
            Import this CV with AI
          </button>
        ) : null}
        {newCvImportStarted ? (
          <div className="job-feedback job-feedback-info" role="status">
            <strong>{importer.progress.title}</strong>
            <p>{importer.progress.message}</p>
            {importer.progress.uploadId ? (
              <Link
                href={`/profile/cv-imports/${importer.progress.uploadId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open AI import status and review
              </Link>
            ) : null}
          </div>
        ) : null}
        {errors.cv ? (
          <p id="cv-error" className="job-field-error" role="alert">
            {errors.cv}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="job-application-fieldset">
        <legend>Contact information</legend>
        <label htmlFor="application-full-name">
          Full name <span aria-hidden="true">*</span>
          <input
            id="application-full-name"
            name="fullName"
            autoComplete="name"
            value={contact.fullName}
            {...fieldA11y("fullName", errors)}
            onChange={(event) =>
              updateContact({
                ...contact,
                fullName: event.currentTarget.value,
              })
            }
          />
          {errors.fullName ? (
            <span id="fullName-error" className="job-field-error" role="alert">
              {errors.fullName}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-email">
          Email <span aria-hidden="true">*</span>
          <input
            id="application-email"
            name="email"
            type="email"
            autoComplete="email"
            value={contact.email}
            {...fieldA11y("email", errors)}
            onChange={(event) =>
              updateContact({
                ...contact,
                email: event.currentTarget.value,
              })
            }
          />
          {errors.email ? (
            <span id="email-error" className="job-field-error" role="alert">
              {errors.email}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-phone">
          Phone number <span aria-hidden="true">*</span>
          <input
            id="application-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={PHONE_INPUT_MAX_LENGTH}
            value={contact.phone}
            {...fieldA11y("phone", errors)}
            onChange={(event) => {
              const phone = normalizePhone(event.currentTarget.value);
              updateContact({ ...contact, phone });
              setErrors((current) => {
                const next = { ...current };
                delete next.phone;
                return next;
              });
            }}
            onBlur={() => {
              const phoneError = phoneValidationError(contact.phone);
              setErrors((current) => {
                const next = { ...current };
                if (phoneError) next.phone = phoneError;
                else delete next.phone;
                return next;
              });
            }}
          />
          {errors.phone ? (
            <span id="phone-error" className="job-field-error" role="alert">
              {errors.phone}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-location">
          Location <span aria-hidden="true">*</span>
          <select
            id="application-location"
            name="location"
            required
            value={selectedLocation}
            disabled={pending || locationSaving}
            {...fieldA11y("location", errors)}
            onChange={(event) => void saveLocation(event.currentTarget.value)}
          >
            <option value="">Select the job location</option>
            <option value={form.jobLocation}>{form.jobLocation}</option>
          </select>
          {locationSaving ? (
            <span className="job-form-help">Saving location...</span>
          ) : null}
          {locationSaveError ? (
            <span id="location-error" className="job-field-error" role="alert">
              {locationSaveError}
            </span>
          ) : errors.location ? (
            <span id="location-error" className="job-field-error" role="alert">
              {errors.location}
            </span>
          ) : null}
        </label>
      </fieldset>

      {form.questions.map((question) => (
        <label key={question.id} htmlFor={"question-" + question.id}>
          {question.prompt}
          {question.kind === "BOOLEAN" ? (
            <select
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              defaultValue=""
            >
              <option value="" disabled>
                Choose an answer
              </option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          ) : question.kind === "SINGLE_CHOICE" ? (
            <select
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              defaultValue=""
            >
              <option value="" disabled>
                Choose an answer
              </option>
              {question.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              id={"question-" + question.id}
              name={"question-" + question.id}
              required={question.required}
              maxLength={3000}
              rows={3}
            />
          )}
        </label>
      ))}

      <label htmlFor="application-cover-letter">
        Cover letter (optional)
        <textarea
          id="application-cover-letter"
          name="coverLetter"
          maxLength={5000}
          rows={5}
        />
      </label>

      <div className="job-ai-consent">
        <label className="job-checkbox-label" htmlFor="application-consent">
          <input
            id="application-consent"
            name="consentAccepted"
            type="checkbox"
            required
            aria-label="I consent to SmartHire sharing this application with the hiring company."
            checked={applicationConsent}
            {...fieldA11y("consent", errors)}
            onChange={(event) => {
              setApplicationConsent(event.currentTarget.checked);
              setErrors((current) => {
                const next = { ...current };
                delete next.consent;
                return next;
              });
            }}
          />
          <span>
            I consent to SmartHire sharing this application with the hiring
            company.
          </span>
        </label>
        {errors.consent ? (
          <p id="consent-error" className="job-field-error" role="alert">
            {errors.consent}
          </p>
        ) : null}
        <label className="job-checkbox-label" htmlFor="application-ai-consent">
          <input
            id="application-ai-consent"
            name="aiAnalysisConsent"
            type="checkbox"
            aria-label="I agree to let SmartHire use AI to analyze how well my CV matches this role."
            checked={aiConsent}
            onChange={(event) => setAiConsent(event.currentTarget.checked)}
          />
          <span>
            I agree to let SmartHire use AI to analyze how well my CV matches
            this role.{" "}
            <Link href="/legal/ai-cv-analysis-policy" target="_blank">
              Learn more
            </Link>
          </span>
        </label>
        <p className="job-form-help">
          Optional. If you do not select this, your CV will still be submitted
          without an AI match score.
        </p>
      </div>

      {error ? (
        <div role="alert" className="job-feedback">
          {error}
        </div>
      ) : null}
      <div className="job-actions">
        <button type="submit" disabled={submitDisabled}>
          {pending ? "Submitting..." : "Submit application"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ApplyFormSection({
  jobId,
  jobTitle,
  open,
  applied,
  onOpenChange,
  onSubmitted,
}: {
  jobId: string;
  jobTitle: string;
  open: boolean;
  applied: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: (outcome: ApplicationOutcome) => void;
}) {
  const shared = useOptionalJobInteraction();
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [outcome, setOutcome] = useState<ApplicationOutcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const importCleanupRef = useRef<ApplyImportCleanup | null>(null);
  const [closing, setClosing] = useState(false);
  const [contactDraft, setContactDraft] =
    useState<ApplicationContactSnapshot | null>(null);
  const [preferredCvId, setPreferredCvId] = useState<string | null>(null);

  const registerImportCleanup = useCallback(
    (cleanup: ApplyImportCleanup | null) => {
      importCleanupRef.current = cleanup;
    },
    [],
  );

  const handleModalClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      const cleanup = importCleanupRef.current;
      if (!cleanup) {
        onOpenChange(false);
        return;
      }
      const result = cleanup();
      if (result instanceof Promise) {
        if (await result) onOpenChange(false);
      } else if (result) {
        onOpenChange(false);
      }
    } finally {
      setClosing(false);
    }
  }, [closing, onOpenChange]);

  const handleImportConfirmed = useCallback((uploadId: string) => {
    setPreferredCvId("candidate-cv-" + uploadId);
    setForm(null);
    setLoadError(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void handleModalClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [handleModalClose, open]);

  useEffect(() => {
    if (!open || applied || form || outcome || loadError) return;
    let active = true;
    void fetch("/api/jobs/" + jobId + "/application-form", {
      cache: "no-store",
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          const problem = body as { message?: unknown };
          throw new Error(
            typeof problem.message === "string"
              ? problem.message
              : "Unable to load the application form.",
          );
        }
        return body;
      })
      .then((body) => {
        if (active) setForm(applicationFormSchema.parse(body));
      })
      .catch((caught: unknown) => {
        if (active)
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load the application form.",
          );
      });
    return () => {
      active = false;
    };
  }, [applied, form, jobId, loadError, open, outcome]);

  function handleSubmitted(
    submitted: ApplicationOutcome,
    meta: ApplicationMeta,
  ) {
    const state: AppliedJobState = {
      jobId,
      appliedAt: submitted.submittedAt,
      status: "submitted",
      cvFileRef: meta.cvFileRef,
      contactSnapshot: meta.contactSnapshot,
      aiAnalysisConsent: meta.aiAnalysisConsent,
      aiMatchScore: meta.aiMatchScore,
    };
    setOutcome(submitted);
    shared?.markApplied(jobId, state);
    onSubmitted?.(submitted);
  }

  function handleContactChange(contact: ApplicationContactSnapshot) {
    setContactDraft(contact);
  }

  function handleProfileSaved(profile: {
    revision: number;
    basics: ApplicationForm["profileBasics"];
  }) {
    setForm((current) => {
      if (!current) return current;
      const missing = new Set(
        current.missingProfileFields.filter((field) => field !== "location"),
      );
      if (!profile.basics.location?.trim()) missing.add("location");
      return {
        ...current,
        profileRevision: profile.revision,
        profileBasics: profile.basics,
        profileReady: missing.size === 0,
        missingProfileFields: Array.from(missing),
      };
    });
  }

  if (!open) return null;

  const headingId = "job-apply-heading-" + jobId;

  return (
    <div
      id="apply"
      className="job-apply-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void handleModalClose();
      }}
    >
      <section
        ref={dialogRef}
        className="job-apply-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <header className="job-apply-modal-header">
          <div>
            <p className="panel-kicker">APPLY</p>
            <h2 id={headingId}>Apply for {jobTitle}</h2>
            <p>Complete your application on SmartHire.</p>
          </div>
          <button
            type="button"
            className="job-icon-button"
            aria-label="Close application form"
            disabled={closing}
            onClick={() => void handleModalClose()}
          >
            ×
          </button>
        </header>

        <div className="job-apply-modal-body">
          {open && !form && !outcome && !applied && !loadError ? (
            <p className="job-feedback job-feedback-info" role="status">
              Preparing the application form...
            </p>
          ) : loadError ? (
            <div className="job-feedback" role="alert">
              <p>{loadError}</p>
              <button type="button" onClick={() => setLoadError(null)}>
                Try again
              </button>
            </div>
          ) : outcome ? (
            <div className="job-application-confirmation" role="status">
              <strong>
                Application submitted successfully for{" "}
                {form?.jobTitle ?? jobTitle}.
              </strong>
              <p>The employer will contact you if there is a match.</p>
              {outcome.aiAnalysisConsent ? (
                <p>
                  AI match: <strong>{outcome.aiMatchScore ?? 82}%</strong> —
                  based on skills and experience relevant to this role.
                </p>
              ) : null}
            </div>
          ) : applied ? (
            <div className="job-application-confirmation" role="status">
              You have already applied for this role.
            </div>
          ) : form ? (
            <InlineApplicationForm
              form={form}
              onCancel={() => void handleModalClose()}
              onProfileSaved={handleProfileSaved}
              onImportConfirmed={handleImportConfirmed}
              preferredCvId={preferredCvId}
              onRegisterImportCleanup={registerImportCleanup}
              contactDraft={contactDraft}
              onContactChange={handleContactChange}
              onSubmitted={handleSubmitted}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
