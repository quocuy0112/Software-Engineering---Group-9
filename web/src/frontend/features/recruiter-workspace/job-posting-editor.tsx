"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  Coffee,
  DollarSign,
  Gift,
  Globe,
  Heart,
  Shield,
  Smile,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/frontend/components/ui/badge";
import { Modal } from "@/frontend/components/ui/modal";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  requestUnsavedChangesNavigation,
  useUnsavedChangesGuard,
} from "@/frontend/features/profile/client/unsaved-changes";
import {
  formatVndInput,
  parseVndInput,
  prepareRecruiterJobForSave,
  validateRecruiterJobForSave,
  type RecruiterJob,
  type RecruiterJobFieldErrors,
} from "@/shared/contracts/recruiter-job-posting";
import {
  deriveRecruiterClassification,
  recruiterIndustryByCode,
  recruiterIndustryOptionFor,
  recruiterIndustryTaxonomy,
  type RecruiterIndustryCode,
  type RecruiterSubIndustrySuggestions,
} from "@/shared/contracts/jobs/industry-taxonomy";
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
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { recruiterJobPostingCopy } from "./recruiter-job-posting-copy";

const benefitIconByName: Record<string, LucideIcon> = {
  award: Award,
  gift: Gift,
  coffee: Coffee,
  car: Car,
  "trending-up": TrendingUp,
  briefcase: Briefcase,
  calendar: CalendarDays,
  "dollar-sign": DollarSign,
  globe: Globe,
  users: Users,
  "book-open": BookOpen,
  activity: Activity,
  heart: Heart,
  shield: Shield,
  smile: Smile,
};

const customSubIndustryValue = "__custom_sub_industry__";
const recruiterDraftAutoSaveStoragePrefix =
  "smarthire.recruiter.job-draft-autosave";
const recruiterDraftAutoSaveChangedEvent =
  "smarthire:recruiter-draft-autosave-changed";
const recruiterDraftAutoSaveDelayMs = 300;

function useRecruiterDraftAutoSave(storageKey: string) {
  const subscribe = useCallback(
    (notify: () => void) => {
      const handleStorage = (event: StorageEvent) => {
        if (event.key === storageKey) notify();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(recruiterDraftAutoSaveChangedEvent, notify);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(recruiterDraftAutoSaveChangedEvent, notify);
      };
    },
    [storageKey],
  );
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(storageKey) === "enabled",
    [storageKey],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function normalizedOption(value: string) {
  return value.trim().toLowerCase();
}

function subIndustryLabels(
  industry: ReturnType<typeof recruiterIndustryOptionFor>,
  suggestions: RecruiterSubIndustrySuggestions,
) {
  const labels = new Map<string, string>();
  for (const [label] of industry.subIndustries ?? []) {
    labels.set(normalizedOption(label), label);
  }
  for (const label of suggestions[industry.code] ?? []) {
    const trimmed = label.trim();
    if (trimmed) labels.set(normalizedOption(trimmed), trimmed);
  }
  return [...labels.values()];
}

function toJobCatalogPayload(job: RecruiterJob): JobCatalogItem {
  const payload: Record<string, unknown> = { ...job };
  delete payload.company;
  delete payload.review;
  delete payload.correctionRequest;
  return payload as unknown as JobCatalogItem;
}

function formLevelError(
  message: string | undefined,
  fallback: string,
  fieldErrors: RecruiterJobFieldErrors,
) {
  return Object.keys(fieldErrors).length === 0 ? (message ?? fallback) : "";
}

function formatReasonCode(
  code: string,
  reasonLabels: Readonly<Record<string, string>>,
): string {
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
  inProgressLabel,
  number,
  onToggle,
  open,
  readyLabel,
  title,
}: {
  children: ReactNode;
  complete: boolean;
  description: string;
  inProgressLabel: string;
  number: number;
  onToggle: (open: boolean) => void;
  open: boolean;
  readyLabel: string;
  title: string;
}) {
  return (
    <details
      className={[
        "recruiter-editor-section",
        "recruiter-surface-card",
        complete ? "is-complete" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
          className={[
            "recruiter-editor-section__status",
            complete ? "is-complete" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {complete ? readyLabel : inProgressLabel}
        </span>
        <ChevronDown
          className="recruiter-editor-section__chevron"
          aria-hidden="true"
        />
      </summary>
      <div className="recruiter-editor-section__body">{children}</div>
    </details>
  );
}

export function JobPostingEditor({
  initialJob,
  companyName,
  autoSavePreferenceScope,
  subIndustrySuggestions = {},
  awaitDraftSaveBeforeBack = false,
  onBack,
  onDraftAutoSaved,
  onSaved,
}: {
  initialJob: RecruiterJob;
  companyName: string;
  autoSavePreferenceScope?: string;
  subIndustrySuggestions?: RecruiterSubIndustrySuggestions;
  /** Routed editors refresh the list page after the draft response arrives. */
  awaitDraftSaveBeforeBack?: boolean;
  onBack: () => void;
  onDraftAutoSaved?: (job: RecruiterJob) => void;
  onSaved: (job: RecruiterJob) => void;
}) {
  const normalizedInitialJob: RecruiterJob = {
    ...initialJob,
    ...prepareRecruiterJobForSave(initialJob),
  };
  const [job, setJob] = useState<RecruiterJob>(normalizedInitialJob);
  const catalogueUpdatedAt = useRef(
    initialJob.id === "new-job" ? null : initialJob.updatedAt,
  );
  const savedIndustryCode = useRef(initialJob.industryCode);
  const csrfProof = useCsrfProof();
  const [saving, setSaving] = useState(false);
  const [pendingSubmission, setPendingSubmission] =
    useState<RecruiterJob | null>(null);
  const submissionKey = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RecruiterJobFieldErrors>({});
  const [openSections, setOpenSections] = useState<boolean[]>(
    sectionNames.map(() => true),
  );
  const [salaryInputs, setSalaryInputs] = useState({
    min: formatVndInput(normalizedInitialJob.salary.min),
    max: formatVndInput(normalizedInitialJob.salary.max),
  });
  const [skillInput, setSkillInput] = useState(
    normalizedInitialJob.skillTags.join(", "),
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const editRevision = useRef(0);
  const autoSaveBlockedRevision = useRef<number | null>(null);
  const autoSaveStorageKey = `${recruiterDraftAutoSaveStoragePrefix}:${autoSavePreferenceScope ?? initialJob.companyId}`;
  const autoSaveEnabled = useRecruiterDraftAutoSave(autoSaveStorageKey);
  const locale = useWorkspaceLocale();
  const copy = useMemo(() => recruiterJobPostingCopy(locale), [locale]);
  const editor = copy.editor;
  const readOnly = job.status === "pending_approval" || job.status === "closed";
  const canSubmitForApproval =
    job.id === "new-job" || job.status === "draft" || job.status === "rejected";
  const defaultSaveStatus: JobPostingStatus = canSubmitForApproval
    ? "draft"
    : job.status;
  useUnsavedChangesGuard(hasUnsavedChanges && !readOnly);
  const salaryRangeInvalid =
    job.salary.max > 0 && job.salary.max < job.salary.min;
  const displayedErrors = salaryRangeInvalid
    ? {
        ...fieldErrors,
        "salary.max": editor.errors.maxSalary,
      }
    : fieldErrors;

  const selectedIndustry = recruiterIndustryOptionFor({
    code: job.industryCode,
    label: job.industry,
  });
  const availableSubIndustries = useMemo(
    () => subIndustryLabels(selectedIndustry, subIndustrySuggestions),
    [selectedIndustry, subIndustrySuggestions],
  );
  const initialIndustry = recruiterIndustryOptionFor(initialJob);
  const initialSubIndustryOptions = subIndustryLabels(
    initialIndustry,
    subIndustrySuggestions,
  );
  const [usesCustomSubIndustry, setUsesCustomSubIndustry] = useState(
    () =>
      initialSubIndustryOptions.length === 0 ||
      (Boolean(initialJob.subIndustry) &&
        !initialSubIndustryOptions.some(
          (label) =>
            normalizedOption(label) ===
            normalizedOption(initialJob.subIndustry),
        )),
  );

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
    editRevision.current += 1;
    autoSaveBlockedRevision.current = null;
    setHasUnsavedChanges(true);
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

  const updateIndustry = (code: string) => {
    const nextIndustry = recruiterIndustryByCode.get(
      code as RecruiterIndustryCode,
    );
    if (!nextIndustry) return;
    setUsesCustomSubIndustry(
      subIndustryLabels(nextIndustry, subIndustrySuggestions).length === 0,
    );
    changeJob(
      (current) => ({
        ...current,
        industry: nextIndustry.label,
        industryCode: nextIndustry.code,
        subIndustry: "",
        categoryFamily: nextIndustry.code,
        categoryIds: [],
        description: {
          ...current.description,
          generalInfo: {
            ...current.description.generalInfo,
            department: null,
          },
        },
      }),
      "industry",
      "subIndustry",
      "categoryFamily",
      "categoryIds",
      "description.generalInfo.department",
    );
  };

  const updateSubIndustry = (value: string) => {
    const classification = deriveRecruiterClassification({
      industry: selectedIndustry.label,
      industryCode: selectedIndustry.code,
      subIndustry: value,
    });
    changeJob(
      (current) => ({
        ...current,
        industry: classification.industry,
        industryCode: classification.industryCode,
        subIndustry: classification.subIndustry,
        categoryFamily: classification.categoryFamily,
        categoryIds: classification.categoryIds,
        description: {
          ...current.description,
          generalInfo: {
            ...current.description.generalInfo,
            department: classification.department,
          },
        },
      }),
      "subIndustry",
      "categoryFamily",
      "categoryIds",
      "description.generalInfo.department",
    );
  };

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

  const persist = useCallback(
    async (
      prepared: RecruiterJob,
      targetStatus: JobPostingStatus,
      options: {
        stayInEditor?: boolean;
        revision?: number;
        keepalive?: boolean;
      } = {},
    ): Promise<boolean> => {
      setSaving(true);
      setError("");
      try {
        if (targetStatus === "pending_approval") {
          // Submission is intentionally two-phase: first persist the exact
          // working copy as a draft, then create the immutable review version.
          // A failed review request therefore never loses the recruiter's work.
          let savedDraft: RecruiterJob = { ...prepared, status: "draft" };
          const shouldPersistDraft =
            prepared.id === "new-job" ||
            prepared.status !== "draft" ||
            prepared.review?.state === "WITHDRAWN" ||
            hasUnsavedChanges;
          if (shouldPersistDraft) {
            const draftJob = toJobCatalogPayload(prepared);
            const draftMethod = prepared.id === "new-job" ? "POST" : "PATCH";
            const previousIndustryCode = savedIndustryCode.current;
            const draftResponse = await fetch("/api/recruiter/job-postings", {
              method: draftMethod,
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfProof,
              },
              body: JSON.stringify(
                draftMethod === "POST"
                  ? { job: draftJob, status: "draft" }
                  : {
                      ...draftJob,
                      status: "draft",
                      previousIndustryCode,
                    },
              ),
            });
            const draftPayload = (await draftResponse
              .json()
              .catch(() => null)) as
              | (RecruiterJob & {
                  message?: string;
                  fieldErrors?: RecruiterJobFieldErrors;
                })
              | null;
            if (!draftResponse.ok || !draftPayload) {
              const nextFieldErrors = draftPayload?.fieldErrors ?? {};
              setFieldErrors(nextFieldErrors);
              setError(
                formLevelError(
                  undefined,
                  editor.errors.unableToSaveDraft,
                  nextFieldErrors,
                ),
              );
              return false;
            }

            savedDraft = {
              ...draftPayload,
              status: "draft",
              company: prepared.company,
            };
          }

          catalogueUpdatedAt.current = savedDraft.updatedAt;
          savedIndustryCode.current = savedDraft.industryCode;
          setJob(savedDraft);
          setHasUnsavedChanges(false);
          setHasSavedDraft(true);

          const reviewJob = toJobCatalogPayload(savedDraft);
          submissionKey.current ??= crypto.randomUUID();
          const submissionResponse = await fetch(
            `/api/recruiter/job-postings/${encodeURIComponent(savedDraft.id)}/submit-review`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "idempotency-key": submissionKey.current,
                "x-csrf-token": csrfProof,
              },
              body: JSON.stringify({
                expectedWorkingUpdatedAt: savedDraft.updatedAt,
                expectedCatalogueUpdatedAt: savedDraft.updatedAt,
                job: reviewJob,
              }),
            },
          );
          const review = (await submissionResponse.json().catch(() => null)) as
            | (NonNullable<RecruiterJob["review"]> & {
                message?: string;
                fieldErrors?: RecruiterJobFieldErrors;
              })
            | { message?: string; fieldErrors?: RecruiterJobFieldErrors }
            | null;
          if (!submissionResponse.ok || !review || !("reviewId" in review)) {
            const nextFieldErrors =
              review && "fieldErrors" in review
                ? (review.fieldErrors ?? {})
                : {};
            setFieldErrors(nextFieldErrors);
            setError(
              formLevelError(
                undefined,
                editor.errors.unableToSubmit,
                nextFieldErrors,
              ),
            );
            return false;
          }
          submissionKey.current = null;
          setHasUnsavedChanges(false);
          onSaved({
            ...savedDraft,
            id: review.jobId,
            status: "pending_approval",
            company: savedDraft.company,
            review: {
              ...review,
              reasonCode: review.reasonCode ?? null,
              publicExplanation: review.publicExplanation ?? null,
              decidedAt: review.decidedAt ?? null,
            },
          });
          return true;
        }

        const method = prepared.id === "new-job" ? "POST" : "PATCH";
        // Keep the recruiter-only company projection out of the request. This
        // also reduces exit-time keepalive payloads.
        const draftJob = toJobCatalogPayload(prepared);
        const previousIndustryCode = savedIndustryCode.current;
        const response = await fetch("/api/recruiter/job-postings", {
          method,
          keepalive: options.keepalive,
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfProof,
          },
          body: JSON.stringify(
            method === "POST"
              ? { job: draftJob, status: "draft" }
              : {
                  ...draftJob,
                  status: "draft",
                  previousIndustryCode,
                },
          ),
        });
        const payload = (await response.json().catch(() => null)) as
          | (RecruiterJob & {
              message?: string;
              fieldErrors?: RecruiterJobFieldErrors;
            })
          | null;
        if (!response.ok) {
          const nextFieldErrors = payload?.fieldErrors ?? {};
          setFieldErrors(nextFieldErrors);
          setError(
            formLevelError(
              undefined,
              editor.errors.unableToSave,
              nextFieldErrors,
            ),
          );
          return false;
        }
        if (!payload) {
          setError(editor.errors.invalidResponse);
          return false;
        }
        catalogueUpdatedAt.current = payload.updatedAt;
        savedIndustryCode.current = payload.industryCode;
        setHasSavedDraft(true);
        if (options.stayInEditor) {
          const savedRevision = options.revision ?? editRevision.current;
          const hasNewerChanges = editRevision.current !== savedRevision;
          setJob((current) =>
            hasNewerChanges
              ? {
                  ...current,
                  id: payload.id,
                  slug: payload.slug,
                  createdByUserId: payload.createdByUserId,
                  postedAt: payload.postedAt,
                  status: "draft",
                }
              : {
                  ...payload,
                  company: current.company,
                },
          );
          setHasUnsavedChanges(hasNewerChanges);
          onDraftAutoSaved?.({ ...payload, company: prepared.company });
        } else {
          setHasUnsavedChanges(false);
          onSaved(payload);
        }
        return true;
      } catch {
        setError(editor.errors.serverUnavailable);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [csrfProof, editor, hasUnsavedChanges, onDraftAutoSaved, onSaved],
  );

  const save = async (targetStatus: JobPostingStatus) => {
    if (readOnly) return;
    const prepared: RecruiterJob = {
      ...job,
      ...prepareRecruiterJobForSave(job),
      company: job.company,
    };
    const nextErrors = validateRecruiterJobForSave(prepared, targetStatus);
    setJob(prepared);
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
              ["level", "education", "description.requirements"].includes(path),
          )
        )
          next[2] = true;
        if (paths.some((path) => path.startsWith("salary."))) next[3] = true;
        if (
          paths.some((path) =>
            ["description.overview", "description.responsibilities"].includes(
              path,
            ),
          )
        )
          next[4] = true;
        if (
          paths.some((path) =>
            ["numberOfHires", "applyDeadline"].includes(path),
          )
        )
          next[5] = true;
        return next;
      });
      setError("");
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

  const toggleAutomaticDraftSave = () => {
    const enabled = !autoSaveEnabled;
    autoSaveBlockedRevision.current = null;
    if (enabled) {
      window.localStorage.setItem(autoSaveStorageKey, "enabled");
    } else {
      window.localStorage.removeItem(autoSaveStorageKey);
    }
    window.dispatchEvent(new Event(recruiterDraftAutoSaveChangedEvent));
  };

  const leaveEditor = async () => {
    if (autoSaveEnabled && hasUnsavedChanges && !saving && !readOnly) {
      const prepared: RecruiterJob = {
        ...job,
        ...prepareRecruiterJobForSave(job),
        company: job.company,
      };
      const draftErrors = validateRecruiterJobForSave(prepared, "draft");
      if (Object.keys(draftErrors).length === 0) {
        const saved = persist(prepared, "draft", {
          stayInEditor: true,
          revision: editRevision.current,
          keepalive: true,
        });
        if (awaitDraftSaveBeforeBack) {
          if (await saved) onBack();
        } else {
          void saved;
          onBack();
        }
        return;
      }
    }
    requestUnsavedChangesNavigation(onBack);
  };

  useEffect(() => {
    if (
      !autoSaveEnabled ||
      readOnly ||
      saving ||
      !hasUnsavedChanges ||
      autoSaveBlockedRevision.current === editRevision.current
    ) {
      return;
    }

    const prepared: RecruiterJob = {
      ...job,
      ...prepareRecruiterJobForSave(job),
      company: job.company,
    };
    if (Object.keys(validateRecruiterJobForSave(prepared, "draft")).length) {
      return;
    }

    const revision = editRevision.current;
    let started = false;
    let timer = 0;
    const saveDraft = (keepalive = false) => {
      if (started) return;
      started = true;
      window.clearTimeout(timer);
      void persist(prepared, "draft", {
        stayInEditor: true,
        revision,
        keepalive,
      }).then((saved) => {
        if (!saved) autoSaveBlockedRevision.current = revision;
      });
    };
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveDraft(true);
    };
    const saveOnPageHide = () => saveDraft(true);
    timer = window.setTimeout(
      () => saveDraft(true),
      recruiterDraftAutoSaveDelayMs,
    );
    window.addEventListener("pagehide", saveOnPageHide);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", saveOnPageHide);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [autoSaveEnabled, hasUnsavedChanges, job, persist, readOnly, saving]);

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
  const saveStatus = saving
    ? copy.saving
    : hasUnsavedChanges
      ? copy.unsaved
      : hasSavedDraft
        ? copy.saved
        : "";
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
          disabled={awaitDraftSaveBeforeBack && saving}
          onClick={() => void leaveEditor()}
        >
          <ArrowLeft aria-hidden="true" />
          {copy.back}
        </button>
        <div className="recruiter-editor__heading-row">
          <div>
            <h1>
              {job.id === "new-job" ? copy.create : job.title || copy.edit}
            </h1>
          </div>
          <button
            type="button"
            className="recruiter-editor-auto-save"
            role="switch"
            aria-checked={autoSaveEnabled}
            aria-label={`${copy.automaticSave}: ${autoSaveEnabled ? copy.on : copy.off}`}
            onClick={toggleAutomaticDraftSave}
          >
            <span className="recruiter-editor-auto-save__label">
              {editor.actions.autoSave}
            </span>
            <span
              className="recruiter-editor-auto-save__track"
              aria-hidden="true"
            >
              <span className="recruiter-editor-auto-save__state">
                {autoSaveEnabled ? copy.on : copy.off}
              </span>
              <span className="recruiter-editor-auto-save__thumb" />
            </span>
          </button>
        </div>
        <p>{editor.intro}</p>
        {job.review?.state === "REJECTED" && job.review.reasonCode ? (
          <div
            className="recruiter-editor-rejection-notice"
            role="alert"
            aria-live="polite"
          >
            <strong>{editor.revisionNeeded}</strong>
            <p>
              <strong>
                {formatReasonCode(job.review.reasonCode, editor.reasonLabels)}
              </strong>
              {job.review.publicExplanation
                ? `: ${job.review.publicExplanation}`
                : null}
            </p>
            <p>{editor.revisionInstruction}</p>
          </div>
        ) : null}
        {job.correctionRequest ? (
          <div
            className="recruiter-editor-rejection-notice"
            role="status"
            aria-live="polite"
          >
            <strong>{editor.administratorRequested}</strong>
            <p>{job.correctionRequest.publicExplanation}</p>
            <p>{editor.approvedVersionLive}</p>
          </div>
        ) : null}
      </div>

      <div className="recruiter-editor-progress recruiter-surface-card">
        <div className="recruiter-editor-progress__copy">
          <span className="recruiter-editor-progress__icon" aria-hidden="true">
            <CheckCircle2 />
          </span>
          <div>
            <strong>{copy.completed(completedSections)}</strong>
            <span>{copy.progressHelp}</span>
          </div>
        </div>
        <strong className="recruiter-editor-progress__percentage">
          {copy.completion(completedSections)}
        </strong>
        <div
          className="recruiter-editor-progress__track"
          role="progressbar"
          aria-label={editor.completionAria}
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
          <p className="recruiter-required-note">{editor.requiredNote}</p>

          <EditorSection
            number={1}
            title={editor.sections.basicInfo}
            description={editor.sections.basicInfoDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[0]}
            open={openSections[0]}
            onToggle={(open) => setSectionOpen(0, open)}
          >
            <label>
              {editor.fields.jobTitle} *
              <input
                disabled={readOnly}
                required
                maxLength={200}
                value={job.title}
                onChange={(event) => update("title", event.target.value)}
                placeholder={editor.placeholders.jobTitle}
                {...fieldA11y("title")}
              />
              <FieldError field="title" errors={displayedErrors} />
            </label>
            <label>
              {editor.fields.shortPitch} *
              <input
                disabled={readOnly}
                required
                maxLength={500}
                value={job.shortPitch}
                onChange={(event) => update("shortPitch", event.target.value)}
                placeholder={editor.placeholders.shortPitch}
                {...fieldA11y("shortPitch")}
              />
              <FieldError field="shortPitch" errors={displayedErrors} />
            </label>
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.industry} *
                <select
                  disabled={readOnly}
                  required
                  value={selectedIndustry.code}
                  onChange={(event) =>
                    updateIndustry(event.currentTarget.value)
                  }
                  {...fieldA11y("industry")}
                >
                  {recruiterIndustryTaxonomy.map((industry) => (
                    <option key={industry.code} value={industry.code}>
                      {industry.label}
                    </option>
                  ))}
                </select>
                <FieldError field="industry" errors={displayedErrors} />
              </label>
              <div className="recruiter-sub-industry-field">
                {availableSubIndustries.length > 0 ? (
                  <>
                    <label htmlFor="recruiter-sub-industry">
                      {editor.fields.subIndustry} *
                    </label>
                    <select
                      id="recruiter-sub-industry"
                      disabled={readOnly}
                      required
                      value={
                        usesCustomSubIndustry
                          ? customSubIndustryValue
                          : job.subIndustry
                      }
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        if (value === customSubIndustryValue) {
                          setUsesCustomSubIndustry(true);
                          updateSubIndustry("");
                          return;
                        }
                        setUsesCustomSubIndustry(false);
                        updateSubIndustry(value);
                      }}
                      {...fieldA11y("subIndustry")}
                    >
                      <option value="" disabled>
                        {editor.fields.chooseSubIndustry}
                      </option>
                      {availableSubIndustries.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                      <option value={customSubIndustryValue}>
                        {editor.fields.addSubIndustry}
                      </option>
                    </select>
                  </>
                ) : null}
                {usesCustomSubIndustry ||
                availableSubIndustries.length === 0 ? (
                  <label htmlFor="recruiter-custom-sub-industry">
                    {availableSubIndustries.length > 0
                      ? `${editor.fields.newSubIndustry} *`
                      : `${editor.fields.subIndustry} *`}
                    <input
                      id="recruiter-custom-sub-industry"
                      disabled={readOnly}
                      required
                      maxLength={160}
                      value={job.subIndustry}
                      onChange={(event) =>
                        updateSubIndustry(event.currentTarget.value)
                      }
                      placeholder={editor.placeholders.subIndustry}
                      {...fieldA11y("subIndustry")}
                    />
                  </label>
                ) : null}
                <FieldError field="subIndustry" errors={displayedErrors} />
              </div>
            </div>
          </EditorSection>

          <EditorSection
            number={2}
            title={editor.sections.location}
            description={editor.sections.locationDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[1]}
            open={openSections[1]}
            onToggle={(open) => setSectionOpen(1, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.city} *
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
                {editor.fields.district}
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
                {editor.fields.workArrangement} *
                <select
                  disabled={readOnly}
                  required
                  value={job.workArrangement}
                  onChange={(event) =>
                    update("workArrangement", event.target.value)
                  }
                >
                  <option value="onsite">
                    {editor.options.workArrangement.onsite}
                  </option>
                  <option value="hybrid">
                    {editor.options.workArrangement.hybrid}
                  </option>
                  <option value="remote">
                    {editor.options.workArrangement.remote}
                  </option>
                </select>
              </label>
              <label>
                {editor.fields.employmentType} *
                <select
                  disabled={readOnly}
                  required
                  value={job.employmentType}
                  onChange={(event) =>
                    update("employmentType", event.target.value)
                  }
                >
                  {employmentOptions.map(([value]) => (
                    <option value={value} key={value}>
                      {editor.options.employment[value]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="recruiter-toggle-grid">
              <ToggleField
                label={editor.fields.nationwideRemote}
                help={editor.fields.nationwideRemoteHelp}
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
                label={editor.fields.workSaturday}
                help={editor.fields.workSaturdayHelp}
                checked={job.workOnSaturday}
                disabled={readOnly}
                onChange={(checked) => update("workOnSaturday", checked)}
              />
            </div>
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.workingHours}
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
                  placeholder={editor.placeholders.workingHours}
                />
              </label>
              <label>
                {editor.fields.workAddress}
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
                  placeholder={editor.placeholders.workAddress}
                />
              </label>
            </div>
          </EditorSection>
          <EditorSection
            number={3}
            title={editor.sections.requirements}
            description={editor.sections.requirementsDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[2]}
            open={openSections[2]}
            onToggle={(open) => setSectionOpen(2, open)}
          >
            <div className="recruiter-form-grid recruiter-form-grid--three">
              <label>
                {editor.fields.minimumYears} *
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
                {editor.fields.experienceLabel} *
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
                      {
                        (editor.options.experience as Record<string, string>)[
                          String(option.minYears)
                        ]
                      }
                    </option>
                  ))}
                </select>
                <FieldError field="experience.label" errors={displayedErrors} />
              </label>
              <label>
                {editor.fields.jobLevel} *
                <select
                  disabled={readOnly}
                  value={job.level}
                  onChange={(event) => update("level", event.target.value)}
                  {...fieldA11y("level")}
                >
                  {!levelOptions.some(([value]) => value === job.level) ? (
                    <option value={job.level}>{titleCase(job.level)}</option>
                  ) : null}
                  {levelOptions.map(([value]) => (
                    <option value={value} key={value}>
                      {editor.options.level[value]}
                    </option>
                  ))}
                </select>
                <FieldError field="level" errors={displayedErrors} />
              </label>
            </div>
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.education} *
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
                      {editor.options.education[option]}
                    </option>
                  ))}
                </select>
                <FieldError field="education" errors={displayedErrors} />
              </label>
              <label>
                {editor.fields.ageRange}
                <input
                  disabled={readOnly}
                  maxLength={80}
                  value={job.age}
                  onChange={(event) => update("age", event.target.value)}
                  placeholder={editor.placeholders.ageRange}
                />
              </label>
            </div>
            <label>
              {editor.fields.skills}
              <span className="recruiter-field-help">
                {editor.fields.skillsHelp}
              </span>
              <input
                disabled={readOnly}
                value={skillInput}
                onChange={(event) => {
                  const value = event.target.value;
                  setSkillInput(value);
                  update("skillTags", skillInputToTags(value));
                }}
                placeholder={editor.placeholders.skills}
              />
            </label>
            <label>
              {editor.fields.requirements}
              <span className="recruiter-field-help">
                {editor.fields.requirementsHelp}
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
                placeholder={editor.placeholders.requirements}
              />
              <FieldError
                field="description.requirements"
                errors={displayedErrors}
              />
            </label>
          </EditorSection>

          <EditorSection
            number={4}
            title={editor.sections.salary}
            description={editor.sections.salaryDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[3]}
            open={openSections[3]}
            onToggle={(open) => setSectionOpen(3, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.minimumSalary}
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
                    placeholder={editor.placeholders.minimumSalary}
                    {...fieldA11y("salary.min")}
                  />
                  <span>VND</span>
                </div>
                <FieldError field="salary.min" errors={displayedErrors} />
              </label>
              <label>
                {editor.fields.maximumSalary}
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
                    placeholder={editor.placeholders.maximumSalary}
                    {...fieldA11y("salary.max")}
                  />
                  <span>VND</span>
                </div>
                <FieldError field="salary.max" errors={displayedErrors} />
              </label>
            </div>
            <p className="recruiter-field-help recruiter-salary-help">
              {editor.fields.salaryHelp}
            </p>
            <ToggleField
              label={editor.fields.negotiable}
              help={editor.fields.negotiableHelp}
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
              <legend>{editor.fields.benefits}</legend>
              <p className="recruiter-field-help">
                {editor.fields.benefitsHelp}
              </p>
              <div className="recruiter-benefit-grid">
                {benefitOptions.map((option) => {
                  const selected = job.description.benefits.find(
                    (benefit) => benefit.icon === option.icon,
                  );
                  const Icon = benefitIconByName[option.icon] ?? Award;
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
                          aria-label={
                            editor.options.benefits[option.icon] ?? option.label
                          }
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
                          <Icon />
                        </span>
                        <span className="recruiter-benefit-card__label">
                          {editor.options.benefits[option.icon] ?? option.label}
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
                            aria-label={editor.benefitLabel(
                              editor.options.benefits[option.icon] ??
                                option.label,
                            )}
                            disabled={readOnly || !selected}
                            tabIndex={selected ? undefined : -1}
                            maxLength={300}
                            value={
                              selected?.label === option.label
                                ? (editor.options.benefits[option.icon] ??
                                  option.label)
                                : (selected?.label ??
                                  editor.options.benefits[option.icon] ??
                                  option.label)
                            }
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
            title={editor.sections.description}
            description={editor.sections.descriptionDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[4]}
            open={openSections[4]}
            onToggle={(open) => setSectionOpen(4, open)}
          >
            <label>
              {editor.fields.overview} *
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
                placeholder={editor.placeholders.overview}
                {...fieldA11y("description.overview")}
              />
              <FieldError
                field="description.overview"
                errors={displayedErrors}
              />
            </label>
            <fieldset className="recruiter-top-reasons">
              <legend>{editor.fields.topReasons}</legend>
              <p className="recruiter-field-help">
                {editor.fields.topReasonsHelp}
              </p>
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  {editor.fields.topReason(index)}
                  <input
                    disabled={readOnly}
                    maxLength={2_000}
                    value={job.description.topReasonsToJoin[index] ?? ""}
                    onChange={(event) =>
                      updateTopReason(index, event.target.value)
                    }
                    placeholder={
                      index === 0
                        ? editor.placeholders.firstReason
                        : editor.placeholders.otherReason
                    }
                  />
                </label>
              ))}
            </fieldset>
            <label>
              {editor.fields.responsibilities}
              <span className="recruiter-field-help">
                {editor.fields.responsibilitiesHelp}
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
                placeholder={editor.placeholders.responsibilities}
              />
              <FieldError
                field="description.responsibilities"
                errors={displayedErrors}
              />
            </label>
            <label>
              {editor.fields.reportsTo}
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
                placeholder={editor.placeholders.reportsTo}
              />
            </label>
          </EditorSection>

          <EditorSection
            number={6}
            title={editor.sections.hiring}
            description={editor.sections.hiringDescription}
            readyLabel={copy.ready}
            inProgressLabel={copy.inProgress}
            complete={sectionCompletion[5]}
            open={openSections[5]}
            onToggle={(open) => setSectionOpen(5, open)}
          >
            <div className="recruiter-form-grid">
              <label>
                {editor.fields.numberOfHires} *
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
                {editor.fields.applicationDeadline}
                {canSubmitForApproval ? " *" : ""}
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
                    changeJob(
                      (current) => ({ ...current, applyDeadline }),
                      "applyDeadline",
                    );
                  }}
                  onBlur={(event) => {
                    const rawValue = event.target.value;
                    if (rawValue && !dateInputToIso(rawValue)) {
                      setFieldErrors((current) => ({
                        ...current,
                        applyDeadline: editor.errors.deadlineInvalid,
                      }));
                      setError("");
                    }
                  }}
                  {...fieldA11y("applyDeadline")}
                />
                <FieldError field="applyDeadline" errors={displayedErrors} />
                <span className="recruiter-field-help">
                  {editor.fields.deadlineHelp}
                </span>
              </label>
            </div>
            <ToggleField
              label={editor.fields.urgentHiring}
              help={editor.fields.urgentHelp}
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
            <span className="recruiter-editor__action-status" role="status">
              {saveStatus}
            </span>
            <button
              type="button"
              className="recruiter-outline-button"
              disabled={awaitDraftSaveBeforeBack && saving}
              onClick={() => void leaveEditor()}
            >
              {editor.actions.cancel}
            </button>
            {readOnly ? (
              <Badge tone={job.status === "closed" ? "neutral" : "warning"}>
                {job.status === "closed"
                  ? editor.actions.closedViewOnly
                  : editor.actions.editingLocked}
              </Badge>
            ) : canSubmitForApproval ? (
              <>
                <button
                  type="button"
                  className="recruiter-outline-button"
                  disabled={saving}
                  onClick={() => void save("draft")}
                >
                  {saving ? copy.saving : editor.actions.saveDraft}
                </button>
                <button
                  type="button"
                  className="recruiter-primary-button"
                  disabled={saving}
                  onClick={() => void save("pending_approval")}
                >
                  {saving
                    ? editor.actions.submitting
                    : job.status === "rejected"
                      ? editor.actions.reviseResubmit
                      : editor.actions.submitApproval}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="recruiter-primary-button"
                disabled={saving}
                onClick={() => void save(defaultSaveStatus)}
              >
                {saving ? copy.saving : editor.actions.saveChanges}
              </button>
            )}
          </div>
        </form>

        <JobPostingPreview companyName={companyName} job={job} />
      </div>

      {/* The accessible Modal is the confirmation equivalent of window.confirm. */}
      <Modal
        open={Boolean(pendingSubmission)}
        title={editor.submitDialog.title}
        description={editor.submitDialog.description}
        icon="✓"
        onClose={() => setPendingSubmission(null)}
      >
        <div className="recruiter-submit-confirmation">
          <p className="recruiter-submit-confirmation__lead">
            {editor.submitDialog.lead}
          </p>
          <div className="recruiter-submit-confirmation__notice">
            <strong>{editor.submitDialog.beforeSubmit}</strong>
            <span>{editor.submitDialog.checklist}</span>
          </div>
          <div className="sh-modal-actions">
            <button
              type="button"
              className="recruiter-outline-button"
              data-autofocus
              onClick={() => setPendingSubmission(null)}
            >
              {editor.actions.cancel}
            </button>
            <button
              type="button"
              className="recruiter-primary-button"
              onClick={confirmSubmission}
            >
              {editor.actions.submitApproval}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
