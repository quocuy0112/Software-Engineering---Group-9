"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Info,
  LockKeyhole,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { applicationCopy } from "@/frontend/features/candidate-applications/i18n/application-copy";
import {
  ApplicationProgressChecklist,
  ApplicationStepper,
} from "./application-stepper";
import type { ApplicationDraft } from "@/shared/contracts/candidate-applications";

export type ApplicationWizardJob = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  employmentType?: string;
  experienceLevel?: string;
  workArrangement?: string;
  applicationDeadline?: string | null;
};

export function normalizedApplicationPhone(value: string) {
  return value.replace(/[^\d+]/gu, "").replace(/(?!^)\+/gu, "");
}

export function isValidApplicationPhone(value: string) {
  return /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/u.test(
    normalizedApplicationPhone(value),
  );
}

export function isValidApplicationUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function displayJobLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dueDateLabel(value: string | null | undefined, locale: "en" | "vi") {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function ApplicationPersonalInformation({
  slug,
  job,
  draft,
  phone,
  currentLocation,
  linkedInPortfolio,
  pending,
  error,
  onPhoneChange,
  onLocationChange,
  onLinkedInPortfolioChange,
  onSaveDraft,
  onContinue,
}: {
  slug: string;
  job: ApplicationWizardJob;
  draft: ApplicationDraft;
  phone: string;
  currentLocation: string;
  linkedInPortfolio: string;
  pending: string | null;
  error: string | null;
  onPhoneChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onLinkedInPortfolioChange: (value: string) => void;
  onSaveDraft: () => void;
  onContinue: () => void;
}) {
  const locale = useWorkspaceLocale();
  const copy = applicationCopy(locale);
  const [touched, setTouched] = useState({
    phone: false,
    location: false,
    linkedInPortfolio: false,
  });
  const phoneError = !phone.trim()
    ? copy.personalInformation.phoneRequired
    : !isValidApplicationPhone(phone)
      ? copy.personalInformation.phoneInvalid
      : null;
  const locationError = !currentLocation.trim()
    ? copy.personalInformation.locationRequired
    : null;
  const linkedInPortfolioError = isValidApplicationUrl(linkedInPortfolio)
    ? null
    : copy.personalInformation.urlInvalid;
  const canContinue = !phoneError && !locationError && !linkedInPortfolioError;
  const dueDate = dueDateLabel(job.applicationDeadline, locale);
  const arrangement = job.workArrangement
    ? displayJobLabel(job.workArrangement)
    : null;
  const location = arrangement
    ? `${job.location} · ${arrangement}`
    : job.location;
  const tags = [
    job.employmentType ? displayJobLabel(job.employmentType) : null,
    job.experienceLevel ? displayJobLabel(job.experienceLevel) : null,
    dueDate ? copy.stepper.dueDate(dueDate) : null,
  ].filter((tag): tag is string => Boolean(tag));

  function markTouched(field: keyof typeof touched) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ phone: true, location: true, linkedInPortfolio: true });
    if (canContinue) onContinue();
  }

  return (
    <main
      className="candidate-application-flow application-personal-information"
      aria-labelledby="application-flow-title"
    >
      <header className="candidate-application-flow__header application-personal-information__header">
        <div>
          <nav
            className="application-ui__breadcrumb"
            aria-label={copy.common.breadcrumb}
          >
            <Link href="/jobs">{copy.common.jobs}</Link>
            <span>/</span>
            <Link href={`/jobs/${encodeURIComponent(slug)}`}>{job.title}</Link>
            <span>/</span>
            <span>{copy.common.apply}</span>
          </nav>
          <p className="application-personal-information__eyebrow">
            <span aria-hidden="true" />
            {copy.personalInformation.eyebrow}
          </p>
          <h1 id="application-flow-title">
            {copy.personalInformation.title(job.title)}
          </h1>
          <p>{copy.personalInformation.subtitle}</p>
        </div>
        <button
          type="button"
          className="application-personal-information__button application-personal-information__button--secondary"
          onClick={onSaveDraft}
          disabled={pending !== null}
        >
          <Save aria-hidden="true" />
          {pending === "save" ? copy.common.saving : copy.common.saveDraft}
        </button>
      </header>

      <ApplicationStepper currentStep={1} />

      {error ? (
        <p className="candidate-application-error" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="application-personal-information__grid">
          <div>
            <section
              className="application-personal-information__card"
              aria-labelledby="personal-information-title"
            >
              <h2 id="personal-information-title">
                {copy.personalInformation.cardTitle}
              </h2>
              <p className="application-personal-information__card-description">
                {copy.personalInformation.cardDescription}
              </p>

              <div className="application-personal-information__field">
                <div className="application-personal-information__field-label">
                  <span>{copy.personalInformation.fullName}</span>
                </div>
                <div
                  className="application-personal-information__locked-box"
                  role="textbox"
                  aria-readonly="true"
                  aria-label={`${copy.personalInformation.fullName}: ${draft.personalInformation.fullName}`}
                >
                  <span>{draft.personalInformation.fullName}</span>
                  <LockKeyhole aria-hidden="true" />
                </div>
              </div>

              <div className="application-personal-information__field">
                <div className="application-personal-information__field-label">
                  <span>{copy.personalInformation.email}</span>
                </div>
                <div
                  className="application-personal-information__locked-box"
                  role="textbox"
                  aria-readonly="true"
                  aria-label={`${copy.personalInformation.email}: ${draft.personalInformation.email}`}
                >
                  <span>{draft.personalInformation.email}</span>
                  <LockKeyhole aria-hidden="true" />
                </div>
                <p className="application-personal-information__locked-note">
                  {copy.personalInformation.lockedEmailNote}{" "}
                  <Link href="/support">
                    {copy.personalInformation.contactSupport}
                  </Link>
                </p>
              </div>

              <div className="application-personal-information__two-col">
                <div className="application-personal-information__field">
                  <label
                    className="application-personal-information__field-label"
                    htmlFor="application-phone"
                  >
                    <span>
                      {copy.personalInformation.phone}{" "}
                      <strong aria-hidden="true">*</strong>
                    </span>
                  </label>
                  <input
                    id="application-phone"
                    name="phone"
                    type="tel"
                    value={phone}
                    maxLength={20}
                    autoComplete="tel"
                    placeholder={copy.personalInformation.phonePlaceholder}
                    onChange={(event) => onPhoneChange(event.target.value)}
                    onBlur={() => markTouched("phone")}
                    disabled={pending !== null}
                    required
                    aria-invalid={touched.phone && Boolean(phoneError)}
                    aria-describedby={
                      touched.phone && phoneError
                        ? "application-phone-error"
                        : "application-phone-hint"
                    }
                  />
                  {touched.phone && phoneError ? (
                    <p
                      id="application-phone-error"
                      className="application-personal-information__field-error"
                    >
                      {phoneError}
                    </p>
                  ) : (
                    <p
                      id="application-phone-hint"
                      className="application-personal-information__field-hint"
                    >
                      {copy.personalInformation.phoneHint}
                    </p>
                  )}
                </div>

                <div className="application-personal-information__field">
                  <label
                    className="application-personal-information__field-label"
                    htmlFor="application-location"
                  >
                    <span>
                      {copy.personalInformation.currentLocation}{" "}
                      <strong aria-hidden="true">*</strong>
                    </span>
                  </label>
                  <input
                    id="application-location"
                    name="currentLocation"
                    type="text"
                    value={currentLocation}
                    maxLength={160}
                    autoComplete="address-level2"
                    placeholder={copy.personalInformation.locationPlaceholder}
                    onChange={(event) => onLocationChange(event.target.value)}
                    onBlur={() => markTouched("location")}
                    disabled={pending !== null}
                    required
                    aria-invalid={touched.location && Boolean(locationError)}
                    aria-describedby={
                      touched.location && locationError
                        ? "application-location-error"
                        : undefined
                    }
                  />
                  {touched.location && locationError ? (
                    <p
                      id="application-location-error"
                      className="application-personal-information__field-error"
                    >
                      {locationError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="application-personal-information__field application-personal-information__field--portfolio">
                <label
                  className="application-personal-information__field-label"
                  htmlFor="application-linkedin"
                >
                  <span>{copy.personalInformation.linkedInPortfolio}</span>
                  <span className="application-personal-information__optional">
                    {copy.personalInformation.optional}
                  </span>
                </label>
                <input
                  id="application-linkedin"
                  name="linkedInPortfolio"
                  type="url"
                  value={linkedInPortfolio}
                  maxLength={2_048}
                  autoComplete="url"
                  placeholder={copy.personalInformation.linkedInPlaceholder}
                  onChange={(event) =>
                    onLinkedInPortfolioChange(event.target.value)
                  }
                  onBlur={() => markTouched("linkedInPortfolio")}
                  disabled={pending !== null}
                  aria-invalid={
                    touched.linkedInPortfolio && Boolean(linkedInPortfolioError)
                  }
                  aria-describedby={
                    touched.linkedInPortfolio && linkedInPortfolioError
                      ? "application-linkedin-error"
                      : "application-linkedin-hint"
                  }
                />
                {touched.linkedInPortfolio && linkedInPortfolioError ? (
                  <p
                    id="application-linkedin-error"
                    className="application-personal-information__field-error"
                  >
                    {linkedInPortfolioError}
                  </p>
                ) : (
                  <p
                    id="application-linkedin-hint"
                    className="application-personal-information__field-hint"
                  >
                    {copy.personalInformation.linkedInHint}
                  </p>
                )}
              </div>

              <div
                className="application-personal-information__callout"
                role="note"
              >
                <span className="application-personal-information__callout-icon">
                  <ShieldCheck aria-hidden="true" />
                </span>
                <div>
                  <strong>{copy.personalInformation.trustTitle}</strong>
                  <p>{copy.personalInformation.trustDescription}</p>
                </div>
              </div>
            </section>

            <div className="application-personal-information__actions">
              <Link
                className="application-personal-information__button application-personal-information__button--secondary"
                href={`/jobs/${encodeURIComponent(slug)}`}
              >
                <ArrowLeft aria-hidden="true" />
                {copy.personalInformation.backToJob}
              </Link>
              <button
                type="submit"
                className="application-personal-information__button application-personal-information__button--primary"
                disabled={pending !== null || !canContinue}
              >
                {copy.personalInformation.continueToFiles}
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <aside className="application-personal-information__sidebar">
            <section className="application-personal-information__card application-personal-information__job-card">
              <span className="application-personal-information__job-icon">
                <BriefcaseBusiness aria-hidden="true" />
              </span>
              <h2>{copy.personalInformation.jobSummary}</h2>
              <strong>{job.title}</strong>
              <p>{job.companyName}</p>
              <small>{location}</small>
              {tags.length ? (
                <div className="application-personal-information__tags">
                  {tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="application-personal-information__card">
              <h2>{copy.personalInformation.applicationProgress}</h2>
              <ApplicationProgressChecklist
                currentStep={1}
                className="application-personal-information__checklist"
              />
            </section>

            <section className="application-personal-information__card application-personal-information__info-card">
              <div className="application-personal-information__info-heading">
                <Info aria-hidden="true" />
                <h2>{copy.personalInformation.whyWeAsk}</h2>
              </div>
              <p>{copy.personalInformation.whyWeAskFirst}</p>
              <p>
                {copy.personalInformation.whyWeAskSecond}{" "}
                <Link href="/profile">
                  {copy.personalInformation.profileAndCv}
                </Link>
                . {copy.personalInformation.whyWeAskThird}
              </p>
            </section>
          </aside>
        </div>
      </form>
    </main>
  );
}
