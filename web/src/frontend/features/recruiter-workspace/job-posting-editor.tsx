"use client";

import { useRef, useState, type ReactNode } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import { Modal } from "@/frontend/components/ui/modal";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  formatVndInput,
  parseVndInput,
  prepareRecruiterJobForSave,
  validateRecruiterJobForSave,
  type RecruiterJob,
  type RecruiterJobFieldErrors,
} from "@/shared/contracts/recruiter-job-posting";
import type {
  JobCatalogItem,
  JobPostingStatus,
} from "@/shared/contracts/jobs/catalog";
import {
  benefitOptions,
  educationOptions,
  employmentOptions,
  experienceOptions,
  levelOptions,
  listToText,
  sectionNames,
  textToList,
  titleCase,
} from "./job-posting-editor-options";
import { JobPostingPreview } from "./job-posting-preview";

function formatReasonCode(code: string): string {
  const reasonLabels: Record<string, string> = {
    INCOMPLETE_OR_UNCLEAR: "Incomplete or unclear information",
    MISLEADING_CONTENT: "Misleading content",
    INAPPROPRIATE_LANGUAGE: "Inappropriate language",
    DUPLICATE_POSTING: "Duplicate posting",
    INVALID_REQUIREMENTS: "Invalid requirements",
    INSUFFICIENT_COMPENSATION: "Insufficient compensation details",
    VERIFICATION_MISMATCH: "Verification mismatch",
    PROHIBITED_CONTENT: "Prohibited content",
    OTHER: "Other reason",
  };
  return reasonLabels[code] || code.replace(/_/g, " ");
}

function skillInputToTags(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function dateInputToIso(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(normalized);
  const localizedMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(normalized);
  const year = isoMatch
    ? Number(isoMatch[1])
    : localizedMatch
      ? Number(localizedMatch[3])
      : NaN;
  const month = isoMatch
    ? Number(isoMatch[2])
    : localizedMatch
      ? Number(localizedMatch[2])
      : NaN;
  const day = isoMatch
    ? Number(isoMatch[3])
    : localizedMatch
      ? Number(localizedMatch[1])
      : NaN;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString();
}

function limitDateInputYear(value: string) {
  const match = /^(\d{5,})-(\d{2})-(\d{2})$/u.exec(value);
  return match ? `${match[1].slice(0, 4)}-${match[2]}-${match[3]}` : value;
}

function FieldError({
  field,
  errors,
}: {
  field: string;
  errors: RecruiterJobFieldErrors;
}) {
  const message = errors[field];
  return message ? (
    <span className="recruiter-field-error" id={`recruiter-${field}-error`}>
      {message}
    </span>
  ) : null;
}

function ToggleField({
  checked,
  disabled,
  help,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  help?: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const inputId = `recruiter-toggle-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")}`;

  return (
    <div
      className="recruiter-toggle-field"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation();
          onChange(event.currentTarget.checked);
        }}
      />
      <label className="recruiter-toggle-field__label" htmlFor={inputId}>
        <span className="recruiter-toggle-field__control" aria-hidden="true" />
        <span>
          <strong>{label}</strong>
          {help ? <small>{help}</small> : null}
        </span>
      </label>
    </div>
  );
}

function EditorSection({
  children,
  complete,
  description,
  number,
  onToggle,
  open,
  title,
}: {
  children: ReactNode;
  complete: boolean;
  description: string;
  number: number;
  onToggle: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <details
      className="recruiter-editor-section recruiter-surface-card"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary>
        <span className="recruiter-editor-section__number">{number}</span>
        <span className="recruiter-editor-section__copy">
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <span
          className={`recruiter-editor-section__status${complete ? "is-complete" : ""}`}
        >
          {complete ? "Ready" : "In progress"}
        </span>
        <span className="recruiter-editor-section__chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="recruiter-editor-section__body">{children}</div>
    </details>
  );
}

export function JobPostingEditor({
  initialJob,
  companyName,
  onBack,
  onSaved,
}: {
  initialJob: RecruiterJob;
  companyName: string;
  onBack: () => void;
  onSaved: (job: RecruiterJob) => void;
}) {
  const [job, setJob] = useState(initialJob);
  const csrfProof = useCsrfProof();
  const [saving, setSaving] = useState(false);
  const [pendingSubmission, setPendingSubmission] =
    useState<JobCatalogItem | null>(null);
  const submissionKey = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RecruiterJobFieldErrors>({});
  const [openSections, setOpenSections] = useState<boolean[]>(
    sectionNames.map(() => true),
  );
  const [salaryInputs, setSalaryInputs] = useState({
    min: formatVndInput(initialJob.salary.min),
    max: formatVndInput(initialJob.salary.max),
  });
  const [skillInput, setSkillInput] = useState(initialJob.skillTags.join(", "));
  const readOnly = job.status === "pending_approval";
  const canSubmitForApproval =
    job.id === "new-job" || job.status === "draft" || job.status === "rejected";
  const defaultSaveStatus: JobPostingStatus = canSubmitForApproval
    ? "draft"
    : job.status;
  const salaryRangeInvalid =
    job.salary.max > 0 && job.salary.max < job.salary.min;
  const displayedErrors = salaryRangeInvalid
    ? {
        ...fieldErrors,
        "salary.max":
          "Maximum salary must be greater than or equal to minimum salary.",
      }
    : fieldErrors;

  const clearFieldErrors = (...fields: string[]) => {
    setFieldErrors((current) => {
      const next = { ...current };
      let changed = false;
      for (const field of fields) {
        if (next[field]) {
          delete next[field];
          changed = true;
        }
      }
      return changed ? next : current;
    });
    setError("");
  };

  const fieldA11y = (field: string) => ({
    "aria-invalid": displayedErrors[field] ? true : undefined,
    "aria-describedby": displayedErrors[field]
      ? `recruiter-${field}-error`
      : undefined,
  });

  const changeJob = (
    updater: (current: JobCatalogItem) => JobCatalogItem,
    ...fields: string[]
  ) => {
    clearFieldErrors(...fields);
    setJob((current) => ({
      ...updater(current),
      company: current.company,
      updatedAt: new Date().toISOString(),
    }));
  };

  const update = <K extends keyof JobCatalogItem>(
    field: K,
    value: JobCatalogItem[K],
  ) => changeJob((current) => ({ ...current, [field]: value }), String(field));

  const updateSalary = (field: "min" | "max", input: string) => {
    const hasLetters = /[a-zA-ZÀ-ỹ]/u.test(input);
    const hasCompleteSuffix = /(?:tr|trieu|triệu|m)\s*$/iu.test(input.trim());
    if (hasLetters && !hasCompleteSuffix) {
      setSalaryInputs((current) => ({ ...current, [field]: input }));
      setError("");
      return;
    }

    const value = parseVndInput(input);
    setSalaryInputs((current) => ({
      ...current,
      [field]: formatVndInput(value),
    }));
    changeJob(
      (current) => ({
        ...current,
        salary: { ...current.salary, [field]: value },
      }),
      `salary.${field}`,
      "salary.max",
    );
  };

  const finishSalaryInput = (field: "min" | "max") =>
    setSalaryInputs((current) => ({
      ...current,
      [field]: formatVndInput(job.salary[field]),
    }));

  const updateTopReason = (index: number, value: string) =>
    changeJob((current) => {
      const reasons = [...current.description.topReasonsToJoin];
      while (reasons.length < 3) reasons.push("");
      reasons[index] = value;
      return {
        ...current,
        description: {
          ...current.description,
          topReasonsToJoin: reasons.slice(0, 3),
        },
      };
    });

  const toggleBenefit = (icon: string, label: string, selected: boolean) =>
    changeJob((current) => ({
      ...current,
      description: {
        ...current.description,
        benefits: selected
          ? current.description.benefits.some(
              (benefit) => benefit.icon === icon,
            )
            ? current.description.benefits
            : [...current.description.benefits, { icon, label }]
          : current.description.benefits.filter(
              (benefit) => benefit.icon !== icon,
            ),
      },
    }));

  const updateBenefitLabel = (icon: string, label: string) =>
    changeJob((current) => ({
      ...current,
      description: {
        ...current.description,
        benefits: current.description.benefits.map((benefit) =>
          benefit.icon === icon ? { ...benefit, label } : benefit,
        ),
      },
    }));

  const persist = async (
    prepared: JobCatalogItem,
    targetStatus: JobPostingStatus,
  ) => {
    setSaving(true);
    setError("");
    try {
      const method = prepared.id === "new-job" ? "POST" : "PATCH";
      const response = await fetch("/api/recruiter/job-postings", {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfProof,
        },
        body: JSON.stringify(
          method === "POST"
            ? { job: prepared, status: "draft" }
            : { ...prepared, status: "draft" },
        ),
      });
      const payload = (await response.json().catch(() => null)) as
        | (RecruiterJob & {
            message?: string;
            fieldErrors?: RecruiterJobFieldErrors;
          })
        | null;
      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors ?? {});
        setError(payload?.message ?? "Unable to save posting.");
        return;
      }
      if (!payload) {
        setError("The server returned an invalid response.");
        return;
      }
      if (targetStatus === "pending_approval") {
        submissionKey.current ??= crypto.randomUUID();
        const submissionResponse = await fetch(
          `/api/recruiter/job-postings/${encodeURIComponent(payload.id)}/submit-review`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "idempotency-key": submissionKey.current,
              "x-csrf-token": csrfProof,
            },
            body: JSON.stringify({
              expectedWorkingUpdatedAt: payload.updatedAt,
            }),
          },
        );
        const review = (await submissionResponse.json().catch(() => null)) as
          | RecruiterJob["review"]
          | { message?: string; fieldErrors?: RecruiterJobFieldErrors }
          | null;
        if (!submissionResponse.ok || !review || !("reviewId" in review)) {
          setFieldErrors(
            review && "fieldErrors" in review ? (review.fieldErrors ?? {}) : {},
          );
          setError(
            review && "message" in review
              ? (review.message ?? "Unable to submit this posting for review.")
              : "Unable to submit this posting for review.",
          );
          return;
        }
        submissionKey.current = null;
        onSaved({ ...payload, status: "pending_approval", review });
        return;
      }
      onSaved(payload);
    } catch {
      setError(
        "Unable to reach the server. Your changes are still available in this form.",
      );
    } finally {
      setSaving(false);
    }
  };

  const save = async (targetStatus: JobPostingStatus) => {
    if (readOnly) return;
    const prepared = prepareRecruiterJobForSave(job);
    const nextErrors = validateRecruiterJobForSave(prepared, targetStatus);
    setJob((current) => ({
      ...prepared,
      company: current.company,
    }));
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setOpenSections((current) => {
        const next = [...current];
        const paths = Object.keys(nextErrors);
        if (
          paths.some((path) =>
            [
              "title",
              "shortPitch",
              "industry",
              "subIndustry",
              "categoryFamily",
            ].includes(path),
          )
        )
          next[0] = true;
        if (
          paths.some(
            (path) =>
              path.startsWith("location.") ||
              path === "workArrangement" ||
              path === "employmentType",
          )
        )
          next[1] = true;
        if (
          paths.some(
            (path) =>
              path.startsWith("experience.") ||
              ["level", "education"].includes(path),
          )
        )
          next[2] = true;
        if (paths.some((path) => path.startsWith("salary."))) next[3] = true;
        if (paths.some((path) => path.startsWith("description.")))
          next[4] = true;
        if (
          paths.some((path) =>
            ["numberOfHires", "applyDeadline"].includes(path),
          )
        )
          next[5] = true;
        return next;
      });
      setError("Review the highlighted fields before saving this posting.");
      return;
    }

    if (targetStatus === "pending_approval") {
      setError("");
      setPendingSubmission(prepared);
      return;
    }

    await persist(prepared, targetStatus);
  };

  const confirmSubmission = () => {
    if (!pendingSubmission) return;
    const prepared = pendingSubmission;
    setPendingSubmission(null);
    void persist(prepared, "pending_approval");
  };

  const department = job.description.generalInfo.department ?? "";
  const minDeadline = new Date().toISOString().slice(0, 10);
  const maxDeadline = "9999-12-31";
  const sectionCompletion = [
    Boolean(
      job.title &&
      job.shortPitch &&
      job.industry &&
      job.subIndustry &&
      job.categoryFamily,
    ),
    Boolean(job.location.city && job.workArrangement && job.employmentType),
    Boolean(job.experience.label && job.level && job.education),
    Boolean(
      job.salary.isNegotiable ||
      (job.salary.min > 0 && job.salary.max >= job.salary.min),
    ),
    Boolean(job.description.overview),
    Boolean(
      job.numberOfHires > 0 && (!canSubmitForApproval || job.applyDeadline),
    ),
  ];
  const completedSections = sectionCompletion.filter(Boolean).length;
  const setSectionOpen = (index: number, open: boolean) =>
    setOpenSections((current) =>
      current[index] === open
        ? current
        : current.map((value, itemIndex) =>
            itemIndex === index ? open : value,
          ),
    );

  return (
    <div className="recruiter-editor">
      <div className="recruiter-editor__heading">
        <button
          type="button"
          className="recruiter-back-button"
          onClick={onBack}
        >
          ← All job postings
        </button>
        <p className="recruiter-eyebrow">
          {job.id === "new-job" ? "Create job posting" : "Edit posting"}
        </p>
        <h1>{job.title || "Untitled job posting"}</h1>
        <p>
          Build a complete, structured listing and review exactly what
          candidates will see.
        </p>
        {job.review?.state === "REJECTED" && job.review.reasonCode ? (
          <div
            className="recruiter-editor-rejection-notice"
            role="alert"
            aria-live="polite"
          >
            <strong>Revision needed</strong>
            <p>
              <strong>{formatReasonCode(job.review.reasonCode)}</strong>
              {job.review.publicExplanation
                ? `: ${job.review.publicExplanation}`
                : null}
            </p>
            <p>Make the required changes and submit again for a new review.</p>
          </div>
        ) : null}
        {job.correctionRequest ? (
          <div
            className="recruiter-editor-rejection-notice"
            role="status"
            aria-live="polite"
          >
            <strong>Administrator requested changes</strong>
            <p>{job.correctionRequest.publicExplanation}</p>
            <p>
              The current approved version remains live until your revised
              version is reviewed.
            </p>
          </div>
        ) : null}
      </div>

      <div className="recruiter-editor-progress recruiter-surface-card">
        <div>
          <strong>{completedSections} of 6 sections ready</strong>
          <span>
            Save a draft after the core required fields are ready; add a
            deadline before submission.
          </span>
        </div>
        <div
          className="recruiter-editor-progress__track"
          role="progressbar"
          aria-label="Job posting completion"
          aria-valuemin={0}
          aria-valuemax={6}
          aria-valuenow={completedSections}
        >
          <span style={{ width: `${(completedSections / 6) * 100}%` }} />
        </div>
      </div>

      <div className="recruiter-editor__grid">
        <form
          className="recruiter-editor__form"
          onSubmit={(event) => event.preventDefault()}
          noValidate
        >
          <p className="recruiter-required-note">
            Fields marked * are required.
          </p>

          <EditorSection
            number={1}
            title="Basic info"
            description="Define how candidates discover and understand the role."
            complete={sectionCompletion[0]}
            open={openSections[0]}
            onToggle={(open) => setSectionOpen(0, open)}
          >
            <label>
              Job title *
              <input
                disabled={readOnly}
                required
                maxLength={200}
                value={job.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder="e.g. Senior Product Designer"
                {...fieldA11y("title")}
              />
              <FieldError field="title" errors={displayedErrors} />
            </label>
            <label>
              Short pitch *
              <input
                disabled={readOnly}
                required
                maxLength={500}
                value={job.shortPitch}
                onChange={(event) => update("shortPitch", event.target.value)}
                placeholder="A concise reason candidates should explore this role"
                {...fieldA11y("shortPitch")}
              />
              <FieldError field="shortPitch" errors={displayedErrors} />
            </label>
            <div className="recruiter-form-grid">
              <label>
                Industry *
                <input
                  disabled={readOnly}
                  required
                  maxLength={160}
                  value={job.industry}
                  onChange={(event) =>
                    changeJob(
                      (current) => ({
                        ...current,
                        industry: event.target.value,
                        industryCode: "",
                      }),
                      "industry",
                    )
                  }
                  {...fieldA11y("industry")}
                />
                <FieldError field="industry" errors={displayedErrors} />
              </label>
              <label>
                Sub-industry *
                <input
                  disabled={readOnly}
                  required
                  maxLength={160}
                  value={job.subIndustry}
                  onChange={(event) =>
                    update("subIndustry", event.target.value)
                  }
                  placeholder="e.g. Software development"
                  {...fieldA11y("subIndustry")}
                />
                <FieldError field="subIndustry" errors={displayedErrors} />
              </label>
            </div>
            <div className="recruiter-form-grid">
              <label>
                Job category *
                <input
                  disabled={readOnly}
                  required
                  maxLength={80}
                  value={job.categoryFamily}
                  onChange={(event) =>
                    update("categoryFamily", event.target.value)
                  }
                  placeholder="e.g. Engineering"
                  {...fieldA11y("categoryFamily")}
                />
                <FieldError field="categoryFamily" errors={displayedErrors} />
              </label>
              <label>
                Department
                <input
                  disabled={readOnly}
                  maxLength={160}
                  value={department}
                  onChange={(event) =>
                    changeJob((current) => ({
                      ...current,
                      description: {
                        ...current.description,
                        generalInfo: {
                          ...current.description.generalInfo,
                          department: event.target.value || null,
                        },
                      },
                    }))
                  }
                  placeholder="e.g. Product & Design"
                />
              </label>
            </div>
            <label>
              Category IDs
              <span className="recruiter-field-help">
                Separate structured category IDs with commas.
              </span>
              <input
                disabled={readOnly}
                value={job.categoryIds.join(", ")}
                onChange={(event) =>
                  update(
                    "categoryIds",
                    event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="engineering, frontend"
              />
            </label>
          </EditorSection>

          <EditorSection
            number={2}
            title="Location & work arrangement"
            description="Set where and how the team works."
            complete={sectionCompletion[1]}
            open={openSections[1]}
            onToggle={(open) => setSectionOpen(1, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                City *
                <input
                  disabled={readOnly}
                  required
                  maxLength={160}
                  value={job.location.city}
                  onChange={(event) =>
                    changeJob(
                      (current) => ({
                        ...current,
                        location: {
                          ...current.location,
                          city: event.target.value,
                        },
                      }),
                      "location.city",
                    )
                  }
                  {...fieldA11y("location.city")}
                />
                <FieldError field="location.city" errors={displayedErrors} />
              </label>
              <label>
                District
                <input
                  disabled={readOnly}
                  maxLength={160}
                  value={job.location.district ?? ""}
                  onChange={(event) =>
                    changeJob((current) => ({
                      ...current,
                      location: {
                        ...current.location,
                        district: event.target.value || null,
                      },
                    }))
                  }
                />
              </label>
            </div>
            <div className="recruiter-form-grid">
              <label>
                Work arrangement *
                <select
                  disabled={readOnly}
                  required
                  value={job.workArrangement}
                  onChange={(event) =>
                    update("workArrangement", event.target.value)
                  }
                >
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </label>
              <label>
                Employment type *
                <select
                  disabled={readOnly}
                  required
                  value={job.employmentType}
                  onChange={(event) =>
                    update("employmentType", event.target.value)
                  }
                >
                  {employmentOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="recruiter-toggle-grid">
              <ToggleField
                label="Nationwide remote"
                help="Candidates can work remotely from anywhere in Vietnam."
                checked={job.location.isNationwideRemote}
                disabled={readOnly}
                onChange={(checked) =>
                  changeJob((current) => ({
                    ...current,
                    location: {
                      ...current.location,
                      isNationwideRemote: checked,
                    },
                    workArrangement: checked
                      ? "remote"
                      : current.workArrangement,
                  }))
                }
              />
              <ToggleField
                label="Work on Saturday"
                help="Make the Saturday schedule visible before candidates apply."
                checked={job.workOnSaturday}
                disabled={readOnly}
                onChange={(checked) => update("workOnSaturday", checked)}
              />
            </div>
            <div className="recruiter-form-grid">
              <label>
                Working hours
                <input
                  disabled={readOnly}
                  maxLength={300}
                  value={job.description.generalInfo.workingHours ?? ""}
                  onChange={(event) =>
                    changeJob((current) => ({
                      ...current,
                      description: {
                        ...current.description,
                        generalInfo: {
                          ...current.description.generalInfo,
                          workingHours: event.target.value || null,
                        },
                      },
                    }))
                  }
                  placeholder="Monday-Friday, 8:30-17:30"
                />
              </label>
              <label>
                Work address
                <input
                  disabled={readOnly}
                  maxLength={300}
                  value={job.description.generalInfo.workAddress ?? ""}
                  onChange={(event) =>
                    changeJob((current) => ({
                      ...current,
                      description: {
                        ...current.description,
                        generalInfo: {
                          ...current.description.generalInfo,
                          workAddress: event.target.value || null,
                        },
                      },
                    }))
                  }
                  placeholder="Specific office address"
                />
              </label>
            </div>
          </EditorSection>
          <EditorSection
            number={3}
            title="Candidate requirements"
            description="Describe the experience and qualifications needed to succeed."
            complete={sectionCompletion[2]}
            open={openSections[2]}
            onToggle={(open) => setSectionOpen(2, open)}
          >
            <div className="recruiter-form-grid recruiter-form-grid--three">
              <label>
                Minimum years *
                <input
                  disabled={readOnly}
                  type="number"
                  min="0"
                  max="60"
                  value={job.experience.minYears}
                  onChange={(event) =>
                    changeJob(
                      (current) => ({
                        ...current,
                        experience: {
                          ...current.experience,
                          minYears: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        },
                      }),
                      "experience.minYears",
                    )
                  }
                  {...fieldA11y("experience.minYears")}
                />
                <FieldError
                  field="experience.minYears"
                  errors={displayedErrors}
                />
              </label>
              <label>
                Experience label *
                <select
                  disabled={readOnly}
                  value={job.experience.label}
                  onChange={(event) => {
                    const option = experienceOptions.find(
                      (item) => item.label === event.target.value,
                    );
                    changeJob(
                      (current) => ({
                        ...current,
                        experience: {
                          minYears:
                            option?.minYears ?? current.experience.minYears,
                          label: event.target.value,
                        },
                      }),
                      "experience.label",
                    );
                  }}
                  {...fieldA11y("experience.label")}
                >
                  {!experienceOptions.some(
                    (item) => item.label === job.experience.label,
                  ) ? (
                    <option value={job.experience.label}>
                      {job.experience.label}
                    </option>
                  ) : null}
                  {experienceOptions.map((option) => (
                    <option value={option.label} key={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FieldError field="experience.label" errors={displayedErrors} />
              </label>
              <label>
                Job level *
                <select
                  disabled={readOnly}
                  value={job.level}
                  onChange={(event) => update("level", event.target.value)}
                  {...fieldA11y("level")}
                >
                  {!levelOptions.some(([value]) => value === job.level) ? (
                    <option value={job.level}>{titleCase(job.level)}</option>
                  ) : null}
                  {levelOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldError field="level" errors={displayedErrors} />
              </label>
            </div>
            <div className="recruiter-form-grid">
              <label>
                Education *
                <select
                  disabled={readOnly}
                  value={job.education}
                  onChange={(event) => update("education", event.target.value)}
                  {...fieldA11y("education")}
                >
                  {!educationOptions.includes(
                    job.education as (typeof educationOptions)[number],
                  ) ? (
                    <option value={job.education}>{job.education}</option>
                  ) : null}
                  {educationOptions.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError field="education" errors={displayedErrors} />
              </label>
              <label>
                Age range
                <input
                  disabled={readOnly}
                  maxLength={80}
                  value={job.age}
                  onChange={(event) => update("age", event.target.value)}
                  placeholder="e.g. 23-26 (optional)"
                />
              </label>
            </div>
            <label>
              Skills
              <span className="recruiter-field-help">
                Separate skills with commas; spaces are allowed inside a skill.
              </span>
              <input
                disabled={readOnly}
                value={skillInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setSkillInput(value);
                  update("skillTags", skillInputToTags(value));
                }}
                placeholder="React, TypeScript, Product design"
              />
            </label>
            <label>
              Requirements
              <span className="recruiter-field-help">
                Enter one requirement per line.
              </span>
              <textarea
                disabled={readOnly}
                rows={6}
                value={listToText(job.description.requirements)}
                onChange={(event) =>
                  changeJob((current) => ({
                    ...current,
                    description: {
                      ...current.description,
                      requirements: textToList(event.target.value),
                    },
                  }))
                }
                placeholder={
                  "3+ years in a similar role\nStrong communication skills\nPortfolio of relevant work"
                }
              />
            </label>
          </EditorSection>

          <EditorSection
            number={4}
            title="Salary & benefits"
            description="Use readable VND amounts and highlight the complete rewards package."
            complete={sectionCompletion[3]}
            open={openSections[3]}
            onToggle={(open) => setSectionOpen(3, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                Minimum salary
                <div className="recruiter-salary-input">
                  <input
                    disabled={readOnly}
                    type="text"
                    inputMode="text"
                    value={salaryInputs.min}
                    onChange={(event) =>
                      updateSalary("min", event.target.value)
                    }
                    onBlur={() => finishSalaryInput("min")}
                    placeholder="29.000.000 or 29tr"
                    {...fieldA11y("salary.min")}
                  />
                  <span>VND</span>
                </div>
                <FieldError field="salary.min" errors={displayedErrors} />
              </label>
              <label>
                Maximum salary
                <div className="recruiter-salary-input">
                  <input
                    disabled={readOnly}
                    type="text"
                    inputMode="text"
                    value={salaryInputs.max}
                    onChange={(event) =>
                      updateSalary("max", event.target.value)
                    }
                    onBlur={() => finishSalaryInput("max")}
                    placeholder="33.000.000 or 33tr"
                    {...fieldA11y("salary.max")}
                  />
                  <span>VND</span>
                </div>
                <FieldError field="salary.max" errors={displayedErrors} />
              </label>
            </div>
            <p className="recruiter-field-help recruiter-salary-help">
              Type the full amount or shorthand such as 29tr. Values are saved
              as plain numbers in jobs.json.
            </p>
            <ToggleField
              label="Negotiable"
              help="Candidates will see that the salary range is open to discussion."
              checked={job.salary.isNegotiable}
              disabled={readOnly}
              onChange={(checked) =>
                changeJob((current) => ({
                  ...current,
                  salary: { ...current.salary, isNegotiable: checked },
                }))
              }
            />

            <fieldset className="recruiter-benefits-fieldset">
              <legend>Benefits</legend>
              <p className="recruiter-field-help">
                Select predefined benefits, then customize the candidate-facing
                label if needed.
              </p>
              <div className="recruiter-benefit-grid">
                {benefitOptions.map((option) => {
                  const selected = job.description.benefits.find(
                    (benefit) => benefit.icon === option.icon,
                  );
                  return (
                    <div
                      className={[
                        "recruiter-benefit-option",
                        selected ? "is-selected" : null,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={option.icon}
                    >
                      <label className="recruiter-benefit-card">
                        <input
                          type="checkbox"
                          aria-label={option.label}
                          disabled={readOnly}
                          checked={Boolean(selected)}
                          onChange={(event) =>
                            toggleBenefit(
                              option.icon,
                              option.label,
                              event.target.checked,
                            )
                          }
                        />
                        <span
                          className="recruiter-benefit-icon"
                          aria-hidden="true"
                        >
                          {option.glyph}
                        </span>
                        <span className="recruiter-benefit-card__label">
                          {option.label}
                        </span>
                        <span
                          className="recruiter-benefit-card__check"
                          aria-hidden="true"
                        >
                          &#10003;
                        </span>
                      </label>
                      <div
                        className="recruiter-benefit-customize"
                        data-visible={Boolean(selected)}
                        aria-hidden={!selected}
                      >
                        <div>
                          <input
                            aria-label={`Benefit label for ${option.label}`}
                            disabled={readOnly || !selected}
                            tabIndex={selected ? undefined : -1}
                            maxLength={300}
                            value={selected?.label ?? option.label}
                            onChange={(event) =>
                              updateBenefitLabel(
                                option.icon,
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </EditorSection>
          <EditorSection
            number={5}
            title="Job description"
            description="Explain the impact, day-to-day work, and strongest reasons to join."
            complete={sectionCompletion[4]}
            open={openSections[4]}
            onToggle={(open) => setSectionOpen(4, open)}
          >
            <label>
              Overview *
              <textarea
                disabled={readOnly}
                required
                maxLength={20_000}
                rows={6}
                value={job.description.overview}
                onChange={(event) =>
                  changeJob(
                    (current) => ({
                      ...current,
                      description: {
                        ...current.description,
                        overview: event.target.value,
                      },
                    }),
                    "description.overview",
                  )
                }
                placeholder="What will this person make possible?"
                {...fieldA11y("description.overview")}
              />
              <FieldError
                field="description.overview"
                errors={displayedErrors}
              />
            </label>
            <fieldset className="recruiter-top-reasons">
              <legend>Top reasons to join</legend>
              <p className="recruiter-field-help">
                Add up to three short highlights shown near the top of the
                listing.
              </p>
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  Top reason {index + 1}
                  <input
                    disabled={readOnly}
                    maxLength={2_000}
                    value={job.description.topReasonsToJoin[index] ?? ""}
                    onChange={(event) =>
                      updateTopReason(index, event.target.value)
                    }
                    placeholder={
                      index === 0
                        ? "e.g. Work directly with international clients"
                        : "Another reason candidates should join"
                    }
                  />
                </label>
              ))}
            </fieldset>
            <label>
              Responsibilities
              <span className="recruiter-field-help">
                Enter one responsibility per line.
              </span>
              <textarea
                disabled={readOnly}
                rows={7}
                value={listToText(job.description.responsibilities)}
                onChange={(event) =>
                  changeJob((current) => ({
                    ...current,
                    description: {
                      ...current.description,
                      responsibilities: textToList(event.target.value),
                    },
                  }))
                }
                placeholder={
                  "Own the roadmap for your domain\nCollaborate with product and engineering\nShare progress with stakeholders"
                }
              />
            </label>
            <label>
              Reports to
              <input
                disabled={readOnly}
                maxLength={160}
                value={job.description.generalInfo.reportsTo ?? ""}
                onChange={(event) =>
                  changeJob((current) => ({
                    ...current,
                    description: {
                      ...current.description,
                      generalInfo: {
                        ...current.description.generalInfo,
                        reportsTo: event.target.value || null,
                      },
                    },
                  }))
                }
                placeholder="e.g. Head of Engineering"
              />
            </label>
          </EditorSection>

          <EditorSection
            number={6}
            title="Hiring settings"
            description="Set headcount, urgency, and the application window."
            complete={sectionCompletion[5]}
            open={openSections[5]}
            onToggle={(open) => setSectionOpen(5, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                Number of hires *
                <input
                  disabled={readOnly}
                  type="number"
                  min="1"
                  max="10000"
                  value={job.numberOfHires}
                  onChange={(event) =>
                    update(
                      "numberOfHires",
                      Math.max(0, Number(event.target.value) || 0),
                    )
                  }
                  {...fieldA11y("numberOfHires")}
                />
                <FieldError field="numberOfHires" errors={displayedErrors} />
              </label>
              <label>
                Application deadline{canSubmitForApproval ? " *" : ""}
                <input
                  disabled={readOnly}
                  type="date"
                  min={minDeadline}
                  max={maxDeadline}
                  defaultValue={job.applyDeadline?.slice(0, 10) ?? ""}
                  onInput={(event) => {
                    const input = event.currentTarget;
                    input.value = limitDateInputYear(input.value);
                  }}
                  onChange={(event) => {
                    const rawValue = limitDateInputYear(
                      event.currentTarget.value,
                    );
                    if (rawValue !== event.currentTarget.value) {
                      event.currentTarget.value = rawValue;
                    }
                    const applyDeadline = dateInputToIso(rawValue);
                    clearFieldErrors("applyDeadline");
                    setJob((current) => ({
                      ...current,
                      applyDeadline,
                      updatedAt: new Date().toISOString(),
                    }));
                  }}
                  onBlur={(event) => {
                    const rawValue = event.target.value;
                    if (rawValue && !dateInputToIso(rawValue)) {
                      setFieldErrors((current) => ({
                        ...current,
                        applyDeadline: "Enter a valid application deadline.",
                      }));
                      setError(
                        "Review the highlighted fields before saving this posting.",
                      );
                    }
                  }}
                  {...fieldA11y("applyDeadline")}
                />
                <FieldError field="applyDeadline" errors={displayedErrors} />
                <span className="recruiter-field-help">
                  Required when submitting for approval; optional for drafts.
                </span>
              </label>
            </div>
            <ToggleField
              label="Urgent hiring"
              help="Highlight this opening as a priority role for candidates."
              checked={job.isUrgent}
              disabled={readOnly}
              onChange={(checked) => update("isUrgent", checked)}
            />
          </EditorSection>

          {error ? (
            <p className="recruiter-form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="recruiter-editor__actions recruiter-surface-card">
            <button
              type="button"
              className="recruiter-outline-button"
              onClick={onBack}
            >
              Cancel
            </button>
            {readOnly ? (
              <Badge tone="warning">Editing locked during review</Badge>
            ) : canSubmitForApproval ? (
              <>
                <button
                  type="button"
                  className="recruiter-outline-button"
                  disabled={saving}
                  onClick={() => void save("draft")}
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  className="recruiter-primary-button"
                  disabled={saving}
                  onClick={() => void save("pending_approval")}
                >
                  {saving
                    ? "Submitting…"
                    : job.status === "rejected"
                      ? "Revise & resubmit"
                      : "Submit for approval"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="recruiter-primary-button"
                disabled={saving}
                onClick={() => void save(defaultSaveStatus)}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            )}
          </div>
        </form>

        <JobPostingPreview companyName={companyName} job={job} />
      </div>

      <Modal
        open={Boolean(pendingSubmission)}
        title="Submit job for approval?"
        description="Send this posting to an Administrator for review."
        icon="✓"
        onClose={() => setPendingSubmission(null)}
      >
        <div className="recruiter-submit-confirmation">
          <p className="recruiter-submit-confirmation__lead">
            Once submitted, this version is locked and cannot be edited until
            the review is complete.
          </p>
          <div className="recruiter-submit-confirmation__notice">
            <strong>Before you submit</strong>
            <span>
              Make sure the title, salary, deadline, and required skills are
              correct.
            </span>
          </div>
          <div className="sh-modal-actions">
            <button
              type="button"
              className="recruiter-outline-button"
              data-autofocus
              onClick={() => setPendingSubmission(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="recruiter-primary-button"
              onClick={confirmSubmission}
            >
              Submit for approval
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
