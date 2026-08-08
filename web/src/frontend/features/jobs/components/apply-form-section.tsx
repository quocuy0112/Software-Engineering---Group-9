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
import { profileMutationOutcomeSchema } from "@/shared/contracts/account/profile";
import { candidateCvSummarySchema } from "@/shared/contracts/cv-import/candidate-cv";
import type {
  ApplicationContactSnapshot,
  ApplicationForm,
  ApplicationOutcome,
} from "@/shared/contracts/jobs/actions";
import {
  DIRECT_APPLICATION_CV_ID,
  applicationFormSchema,
  applicationOutcomeSchema,
} from "@/shared/contracts/jobs/actions";
import { useOptionalJobInteraction } from "./job-interaction-provider";

const MAX_CV_BYTES = 5_000_000;
const PHONE_INPUT_MAX_LENGTH = 15;
const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
type FieldErrors = Record<string, string>;
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

function RequiredMark() {
  return (
    <span className="job-required-mark" aria-hidden="true">
      *
    </span>
  );
}

function InlineApplicationForm({
  form,
  onProfileSaved,
  contactDraft,
  onContactChange,
  onSubmitted,
}: {
  form: ApplicationForm;
  onProfileSaved: (profile: {
    revision: number;
    basics: ApplicationForm["profileBasics"];
  }) => void;
  contactDraft: ApplicationContactSnapshot | null;
  onContactChange: (contact: ApplicationContactSnapshot) => void;
  onSubmitted: (outcome: ApplicationOutcome) => void;
}) {
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const cvUploadIdempotencyKey = useRef<string | null>(null);
  const [selectedCvId, setSelectedCvId] = useState(() =>
    form.cvs.length === 1 ? form.cvs[0]!.id : "",
  );
  const [savedCvs, setSavedCvs] = useState(() => form.cvs);
  const [newCvFile, setNewCvFile] = useState<File | null>(null);
  const [newCvAttached, setNewCvAttached] = useState(false);
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
  const [cvSaving, setCvSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cvSelectionError, setCvSelectionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateContact(next: ApplicationContactSnapshot) {
    setContact(next);
    onContactChange(next);
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const accepted =
      ACCEPTED_CV_TYPES.has(file.type) ||
      extension === "pdf" ||
      extension === "doc" ||
      extension === "docx";
    if (!accepted) {
      setNewCvFile(null);
      setNewCvAttached(false);
      setCvSelectionError("CV files must be PDF, DOC, or DOCX.");
      setErrors((current) => {
        const next = { ...current };
        delete next.cv;
        return next;
      });
      return;
    }
    if (file.size < 1 || file.size > MAX_CV_BYTES) {
      setNewCvFile(null);
      setNewCvAttached(false);
      setCvSelectionError(
        "CV files must be between 1 and 5 MB and must be PDF, DOC, or DOCX.",
      );
      setErrors((current) => {
        const next = { ...current };
        delete next.cv;
        return next;
      });
      return;
    }
    setNewCvFile(file);
    setNewCvAttached(false);
    setCvSelectionError(null);
    cvUploadIdempotencyKey.current = null;
    setSelectedCvId("");
    setErrors((current) => {
      const next = { ...current };
      delete next.cv;
      return next;
    });
  }

  async function attachNewCv() {
    if (!newCvFile || newCvAttached || cvSaving) return;
    setCvSaving(true);
    setError(null);
    try {
      cvUploadIdempotencyKey.current ??=
        globalThis.crypto?.randomUUID?.() ?? "cv-upload-" + Date.now() + "-key";
      const multipart = new FormData();
      multipart.append("file", newCvFile, newCvFile.name);
      const response = await mutateWithCurrentCsrf(
        "/api/account/candidate-cvs",
        {
          method: "POST",
          headers: { "Idempotency-Key": cvUploadIdempotencyKey.current },
          body: multipart,
        },
        form.csrfToken || csrfProof,
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const problem = body as { message?: unknown } | null;
        throw new Error(
          typeof problem?.message === "string"
            ? problem.message
            : "Unable to save this CV to your Profile.",
        );
      }
      const saved = candidateCvSummarySchema.parse(body);
      setSavedCvs((current) => [
        saved,
        ...current.filter((cv) => cv.id !== saved.id),
      ]);
      setSelectedCvId(saved.id);
      setNewCvAttached(true);
      setCvSelectionError(null);
      setErrors((current) => {
        const next = { ...current };
        delete next.cv;
        return next;
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save this CV to your Profile.",
      );
    } finally {
      setCvSaving(false);
    }
  }

  function validate(): boolean {
    const next = validateContact({
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: normalizePhone(contact.phone),
    });
    if (!selectedCvId && !(newCvFile && newCvAttached)) {
      next.cv = newCvFile
        ? "Select Import CV before applying this new CV."
        : (cvSelectionError ??
          "Select a saved CV or attach a valid PDF, DOC, or DOCX file.");
    }
    if (!locationReady) {
      next.location = selectedLocation
        ? "Save the selected job location before applying."
        : "Select the job location.";
    }
    if (!applicationConsent)
      next.consent = "Accept the application consent before applying.";
    setErrors(next);
    const firstInvalidField = Object.keys(next)[0];
    if (firstInvalidField) {
      const fieldIds: Record<string, string> = {
        cv: "application-cv-id",
        fullName: "application-full-name",
        email: "application-email",
        phone: "application-phone",
        location: "application-location",
        consent: "application-consent",
      };
      window.requestAnimationFrame(() =>
        document.getElementById(fieldIds[firstInvalidField] ?? "")?.focus(),
      );
    }
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
    const directCv =
      newCvFile && newCvAttached && !selectedCvId ? newCvFile : null;
    const cvFileRef = selectedCvId || null;
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
        cvId: directCv ? DIRECT_APPLICATION_CV_ID : selectedCvId || cvFileRef,
        cvFileRef,
        contactSnapshot,
        answers,
        coverLetter: String(data.get("coverLetter") ?? "") || null,
        consentVersion: form.consentVersion,
        consentAccepted: applicationConsent,
        aiAnalysisConsent: aiConsent,
      };
      const requestBody = directCv
        ? (() => {
            const multipart = new FormData();
            multipart.append("application", JSON.stringify(payload));
            multipart.append("cvFile", directCv, directCv.name);
            return multipart;
          })()
        : JSON.stringify(payload);
      const response = await mutateWithCurrentCsrf(
        "/api/jobs/" + form.jobId + "/applications",
        {
          method: "POST",
          headers: {
            ...(directCv ? {} : { "Content-Type": "application/json" }),
            "Idempotency-Key": idempotencyKey.current,
          },
          body: requestBody,
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
      onSubmitted({
        ...outcome,
        aiAnalysisConsent: aiConsent,
        aiMatchScore: aiConsent ? 82 : null,
      });
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
  const submitDisabled = pending || locationSaving || cvSaving;

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
      <p className="job-required-note">
        <RequiredMark /> Required fields
      </p>
      {!profileReady ? (
        <div role="alert">
          Please complete these profile fields first:{" "}
          {missingProfileFields.join(", ")}.
        </div>
      ) : null}

      <fieldset className="job-application-fieldset">
        <legend>
          Application CV
          <RequiredMark />
        </legend>
        <p className="job-form-help">
          Select exactly one confirmed CV from your Profile, or import one new
          PDF, DOC, or DOCX file.
        </p>
        <label htmlFor="application-cv-id">
          Select a CV from Profile
          <select
            id="application-cv-id"
            name="cvId"
            required
            value={selectedCvId}
            disabled={pending || cvSaving}
            {...fieldA11y("cv", errors)}
            onChange={(event) => {
              setSelectedCvId(event.currentTarget.value);
              setNewCvFile(null);
              setNewCvAttached(false);
              setCvSelectionError(null);
              setErrors((current) => {
                const next = { ...current };
                delete next.cv;
                return next;
              });
            }}
          >
            <option value="">
              {savedCvs.length
                ? "Select one saved CV"
                : "No confirmed CVs in Profile"}
            </option>
            {savedCvs.map((cv) => (
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
              ? "CV file selected"
              : "Drag a CV here or click to choose"}
          </span>
          <span className="job-form-help">PDF, DOC, DOCX · up to 5 MB</span>
          <input
            ref={fileInputRef}
            id="application-cv-upload"
            name="newCvFile"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-describedby={errors.cv ? "cv-error" : undefined}
            disabled={pending || cvSaving}
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
                disabled={pending || cvSaving}
              >
                Change file
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCvFile(null);
                  setNewCvAttached(false);
                  setSelectedCvId("");
                  cvUploadIdempotencyKey.current = null;
                  setCvSelectionError(null);
                  setErrors((current) => {
                    const next = { ...current };
                    delete next.cv;
                    return next;
                  });
                }}
                disabled={pending || cvSaving}
              >
                Remove
              </button>
            </span>
          </div>
        ) : null}
        {newCvFile && !newCvAttached ? (
          <button
            type="button"
            onClick={() => void attachNewCv()}
            disabled={submitDisabled}
          >
            {cvSaving ? "Saving CV..." : "Import CV"}
          </button>
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
          <span className="job-field-label">
            Full name
            <RequiredMark />
          </span>
          <input
            id="application-full-name"
            name="fullName"
            required
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
          <span className="job-field-label">
            Email
            <RequiredMark />
          </span>
          <input
            id="application-email"
            name="email"
            type="email"
            required
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
          <span className="job-field-label">
            Phone number
            <RequiredMark />
          </span>
          <input
            id="application-phone"
            name="phone"
            type="tel"
            required
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
          <span className="job-field-label">
            Location
            <RequiredMark />
          </span>
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
          <span className="job-field-label">
            {question.prompt}
            {question.required ? <RequiredMark /> : null}
          </span>
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

      {error ? (
        <div role="alert" className="job-feedback">
          {error}
        </div>
      ) : null}
      <div className="job-actions">
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
              <RequiredMark />
            </span>
          </label>
          {errors.consent ? (
            <p id="consent-error" className="job-field-error" role="alert">
              {errors.consent}
            </p>
          ) : null}
        </div>
        <div className="job-ai-consent">
          <label
            className="job-checkbox-label"
            htmlFor="application-ai-consent"
          >
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
            Optional. If you do not select this, your CV will be submitted
            without an AI match score.
          </p>
        </div>
        <button type="submit" disabled={submitDisabled}>
          {pending ? "Submitting..." : "Submit application"}
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
  const [closing, setClosing] = useState(false);
  const [contactDraft, setContactDraft] =
    useState<ApplicationContactSnapshot | null>(null);
  const wasOpenRef = useRef(false);

  const handleModalClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    onOpenChange(false);
    setClosing(false);
  }, [closing, onOpenChange]);

  useEffect(() => {
    const reopened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (reopened && form && form.cvs.length === 0 && !outcome && !applied) {
      setForm(null);
      setLoadError(null);
    }
  }, [applied, form, open, outcome]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

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

  function handleSubmitted(submitted: ApplicationOutcome) {
    setOutcome(submitted);
    shared?.markApplied(jobId);
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
    <div id="apply" className="job-apply-modal-backdrop" role="presentation">
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
              onProfileSaved={handleProfileSaved}
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
