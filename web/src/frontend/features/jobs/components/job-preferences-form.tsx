"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  VIETNAM_PROVINCES_63,
  jobExperiencePreferenceOptions,
  jobPreferencesSchema,
  type JobPreferences,
} from "@/shared/contracts/jobs/preferences";
import type { JobPositionOption } from "@/shared/contracts/jobs/workspace";
import {
  SearchableChipSelect,
  type SearchableChipOption,
} from "./searchable-chip-select";

type FormState = Omit<JobPreferences, "desiredSalaryMin"> & {
  desiredSalaryMin: string;
};

function toFormState(preferences: JobPreferences): FormState {
  return {
    ...preferences,
    desiredSalaryMin:
      preferences.desiredSalaryMin > 0
        ? String(preferences.desiredSalaryMin)
        : "",
  };
}

function formatSalaryInput(value: string) {
  const digits = value.replace(/[^\d]/gu, "");
  return digits ? new Intl.NumberFormat("en-US").format(Number(digits)) : "";
}

function positionOptions(options: JobPositionOption[]): SearchableChipOption[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label.replace(/\s*·\s*r\d+\s*$/iu, "").trim(),
    keywords: [option.family],
  }));
}

function valueOptions(values: readonly string[]): SearchableChipOption[] {
  return values.map((value) => ({ value, label: value }));
}

export function JobPreferencesForm({
  initialPreferences,
  positionOptions: availablePositions,
  skillOptions,
}: {
  initialPreferences: JobPreferences;
  positionOptions: JobPositionOption[];
  skillOptions: string[];
}) {
  const router = useRouter();
  const csrfProof = useCsrfProof();
  const [form, setForm] = useState(() => toFormState(initialPreferences));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!form.aiAnalysisConsent) {
      setError(
        "AI-analysis consent is required before SmartHire can recommend jobs.",
      );
      return;
    }
    const parsed = jobPreferencesSchema.safeParse({
      ...form,
      desiredSalaryMin:
        Number(form.desiredSalaryMin.replace(/[^\d]/gu, "")) || 0,
    });
    if (!parsed.success) {
      setError("Please review the information you entered.");
      return;
    }
    setPending(true);
    try {
      const response = await mutateWithCurrentCsrf(
        "/api/jobs/user-state",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update-preferences",
            jobPreferences: parsed.data,
          }),
        },
        csrfProof,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: unknown;
        } | null;
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : "Could not update job preferences.",
        );
      }
      setStatus("Job preferences updated.");
      router.push("/jobs/matches");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update job preferences.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="job-preferences-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="job-preferences-banner">
        <span aria-hidden="true">✦</span>
        <div>
          <strong>Get matched to relevant opportunities</strong>
          <p>
            Tell us what you want next so SmartHire can surface better matches.
          </p>
        </div>
      </div>
      <p className="job-preferences-required">
        <span>*</span> Required information
      </p>
      {error ? (
        <div className="job-preferences-message is-error" role="alert">
          {error}
        </div>
      ) : null}
      {status ? (
        <div className="job-preferences-message is-success" role="status">
          {status}
        </div>
      ) : null}

      <fieldset>
        <legend>Personal information</legend>
        <div className="preference-field">
          <span className="preference-label">Gender</span>
          <div className="preference-radio-group">
            {[
              ["female", "Female"],
              ["male", "Male"],
              ["undisclosed", "Prefer not to say"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="gender"
                  value={value}
                  checked={form.gender === value}
                  onChange={() =>
                    setForm((current) => ({
                      ...current,
                      gender: value as JobPreferences["gender"],
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Job needs</legend>
        <div className="preference-field">
          <SearchableChipSelect
            id="professional-positions"
            label="Professional Position"
            placeholder="Search professional positions"
            options={positionOptions(availablePositions)}
            selectedValues={form.professionalPositions}
            maximum={5}
            required
            onChange={(values) =>
              setForm((current) => ({
                ...current,
                professionalPositions: values,
              }))
            }
          />
        </div>

        <div className="preference-field">
          <SearchableChipSelect
            id="custom-positions"
            label="Custom Position"
            placeholder="Search or add a position not in the category list"
            options={[]}
            selectedValues={form.customPositions}
            maximum={5}
            allowCustom
            helperText="Add up to 5 custom positions."
            onChange={(values) =>
              setForm((current) => ({
                ...current,
                customPositions: values,
              }))
            }
          />
        </div>

        <div className="preference-field">
          <SearchableChipSelect
            id="skills"
            label="Skills"
            placeholder="Search skills"
            options={valueOptions(skillOptions)}
            selectedValues={form.skills}
            maximum={20}
            required
            onChange={(values) =>
              setForm((current) => ({
                ...current,
                skills: values,
              }))
            }
          />
        </div>

        <div className="preference-field">
          <label className="preference-label" htmlFor="experience-level">
            Experience <span>*</span>
          </label>
          <select
            id="experience-level"
            className="preference-select"
            value={form.experienceLevel}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                experienceLevel: event.target
                  .value as JobPreferences["experienceLevel"],
              }))
            }
          >
            {jobExperiencePreferenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="preference-field">
          <label className="preference-label" htmlFor="desired-salary">
            Desired Salary <span>*</span>
          </label>
          <div className="preference-input-suffix">
            <input
              id="desired-salary"
              inputMode="numeric"
              value={formatSalaryInput(form.desiredSalaryMin)}
              placeholder="15,000,000"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  desiredSalaryMin: event.target.value.replace(/[^\d]/gu, ""),
                }))
              }
            />
            <span>VND</span>
          </div>
        </div>

        <div className="preference-field">
          <SearchableChipSelect
            id="work-locations"
            label="Province/City (pre 7/1/2025)"
            placeholder="Search provinces or cities"
            options={valueOptions(VIETNAM_PROVINCES_63)}
            selectedValues={form.workLocations}
            maximum={63}
            required
            onChange={(values) =>
              setForm((current) => ({
                ...current,
                workLocations: values,
              }))
            }
          />
        </div>
        <label className="preference-checkbox">
          <input
            type="checkbox"
            checked={form.openToRelocation}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                openToRelocation: event.target.checked,
              }))
            }
          />
          I&apos;m open to relocating
        </label>
      </fieldset>

      <fieldset>
        <legend>Consent</legend>
        <label className="preference-checkbox">
          <input
            type="checkbox"
            required
            checked={form.aiAnalysisConsent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                aiAnalysisConsent: event.target.checked,
              }))
            }
          />
          I agree to let SmartHire recommend jobs based on my CV and job-search
          activity, using AI-based analysis. <span>*</span>
        </label>
        <label className="preference-checkbox">
          <input
            type="checkbox"
            checked={form.jobUpdateNotificationConsent}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                jobUpdateNotificationConsent: event.target.checked,
              }))
            }
          />
          I agree to let SmartHire send me information about jobs and career
          events.
        </label>
      </fieldset>

      <div className="job-preferences-actions">
        <button className="dashboard-hero-cta" type="submit" disabled={pending}>
          {pending ? "Updating..." : "Update"}
        </button>
      </div>
    </form>
  );
}
