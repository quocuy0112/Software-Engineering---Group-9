"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { CompanyAvatar } from "@/frontend/features/jobs/components/company-avatar";
import {
  companyLogoSchema,
  type RecruiterCompanySettings,
  type RecruiterCompanySettingsInput,
} from "@/shared/contracts/jobs/catalog";
import { MAX_OWNED_COMPANIES_PER_USER } from "@/shared/contracts/company-ownership";
import { RECRUITER_AUTHORITY_CHANGED_EVENT } from "@/shared/contracts/recruiter-header-status";
import styles from "./company-settings-screen.module.css";
import {
  ALL_RECRUITER_COMPANIES,
  useRecruiterCompanyScope,
} from "./recruiter-company-scope";
import { getCompanyTeamCopy } from "./company-team-copy";

type Props = {
  initialCompany: RecruiterCompanySettings | null;
  initialCompanies?: RecruiterCompanySettings[];
  canManageTeam?: boolean;
  initialCompanyId?: string;
};
type FormState = RecruiterCompanySettingsInput;
type FieldName = "name" | "industry" | "size" | "address" | "logo";
type FieldErrors = Partial<Record<FieldName | "website", string>>;

function emptyForm(): FormState {
  return {
    name: "",
    logo: null,
    size: "",
    industry: "",
    address: "",
    website: null,
    description: null,
    foundedYear: null,
  };
}

const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DESCRIPTION_MIN_HEIGHT = 90;
const profileFields: Array<{ key: FieldName; label: string }> = [
  { key: "name", label: "Company name" },
  { key: "industry", label: "Industry" },
  { key: "size", label: "Company size" },
  { key: "address", label: "Address" },
  { key: "logo", label: "Company logo" },
];

function formFromCompany(company: RecruiterCompanySettings): FormState {
  return {
    name: company.name,
    logo: company.logo,
    size: company.size,
    industry: company.industry,
    address: company.address,
    website: company.website,
    description: company.description,
    foundedYear: company.foundedYear,
  };
}

function resizeDescription(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${Math.max(element.scrollHeight, DESCRIPTION_MIN_HEIGHT)}px`;
}

function statusClass(status: RecruiterCompanySettings["verificationStatus"]) {
  if (status === "approved") return styles.badgeGood;
  if (status === "rejected") return styles.badgeError;
  return styles.badgeWarning;
}

function statusLabel(status: RecruiterCompanySettings["verificationStatus"]) {
  return status === "approved"
    ? "Approved"
    : status === "rejected"
      ? "Rejected"
      : "Pending";
}

function statusIcon(status: RecruiterCompanySettings["verificationStatus"]) {
  return status === "approved" ? "✓" : status === "rejected" ? "!" : "•";
}

type ProfileValidation = {
  missingFields: FieldName[];
  fieldErrors: Partial<Record<FieldName, string>>;
};

export function getCompanyProfileValidation(
  form: FormState,
): ProfileValidation {
  const missingFields: FieldName[] = [];
  const fieldErrors: Partial<Record<FieldName, string>> = {};

  for (const { key, label } of profileFields) {
    const value = form[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      missingFields.push(key);
      fieldErrors[key] = `${label} is required.`;
      continue;
    }

    if (key === "logo" && !companyLogoSchema.safeParse(value).success) {
      missingFields.push(key);
      fieldErrors[key] =
        "Choose a saved PNG, JPEG, or WebP logo before posting a job.";
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[recruiter] posting gate validation", {
      fields: profileFields.map(({ key }) => ({
        field: key,
        value:
          key === "logo" ? (form[key] ? "[uploaded logo]" : null) : form[key],
        valid: !fieldErrors[key],
        reason: fieldErrors[key] ?? null,
      })),
      profileComplete: missingFields.length === 0,
    });
  }

  return { missingFields, fieldErrors };
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  Object.assign(errors, getCompanyProfileValidation(form).fieldErrors);
  if (form.website) {
    try {
      new URL(form.website);
    } catch {
      errors.website = "Enter a valid website URL.";
    }
  }
  return errors;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The selected logo could not be read."));
    };
    reader.onerror = () =>
      reject(new Error("The selected logo could not be read."));
    reader.readAsDataURL(file);
  });
}

async function optimizeLogo(file: File) {
  if (!ACCEPTED_LOGO_TYPES.has(file.type) || file.size > MAX_LOGO_FILE_BYTES) {
    throw new Error("Choose a PNG, JPEG, or WebP logo up to 5 MB.");
  }
  const source = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const loaded = new window.Image();
    loaded.onload = () => resolve(loaded);
    loaded.onerror = () =>
      reject(new Error("The selected logo could not be decoded."));
    loaded.src = source;
  });
  const maxDimension = 512;
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("The logo preview is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.86);
  const result = webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", 0.86);
  if (result.length > 1_100_000) {
    throw new Error(
      "Choose a simpler logo image under 800 KB after compression.",
    );
  }
  return result;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="5.5"
        y="10"
        width="13"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <small className={styles.fieldError} id={id} role="alert">
      {message}
    </small>
  ) : null;
}

function fieldClass(hasError: boolean) {
  return hasError ? `${styles.field} ${styles.error}` : styles.field;
}

function companyRoleLabel(role?: RecruiterCompanySettings["role"]) {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "HR_MANAGER":
      return "Authorized recruiter · HR Manager";
    case "RECRUITER":
      return "Authorized recruiter";
    case "HIRING_MANAGER":
      return "Authorized recruiter · Hiring manager";
    default:
      return "Authorized recruiter/member";
  }
}

function CompanySwitcherGroup({
  title,
  description,
  countLabel,
  companies,
  activeCompanyId,
  emptyMessage,
  onSelect,
}: {
  title: string;
  description: string;
  countLabel: string;
  companies: RecruiterCompanySettings[];
  activeCompanyId: string | null;
  emptyMessage: string;
  onSelect: (companyId: string) => void;
}) {
  const headingId = `company-switcher-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")}`;

  return (
    <section
      className={styles.companySwitcherSection}
      aria-labelledby={headingId}
    >
      <div className={styles.companySwitcherSectionHeader}>
        <div>
          <h2 className={styles.companySwitcherSectionTitle} id={headingId}>
            {title}
          </h2>
          <p className={styles.companySwitcherSectionDescription}>
            {description}
          </p>
        </div>
        <span className={styles.companySwitcherSectionCount}>{countLabel}</span>
      </div>
      {companies.length ? (
        <div
          className={styles.companySwitcherList}
          role="list"
          aria-label={`${title} companies`}
        >
          {companies.map((candidate) => (
            <div role="listitem" key={candidate.id}>
              <button
                className={`${styles.companySwitcherItem}${candidate.id === activeCompanyId ? ` ${styles.companySwitcherItemActive}` : ""}`}
                type="button"
                aria-pressed={candidate.id === activeCompanyId}
                onClick={() => onSelect(candidate.id)}
              >
                <CompanyAvatar
                  name={candidate.name}
                  imageUrl={candidate.logo}
                  size="sm"
                />
                <span className={styles.companySwitcherCopy}>
                  <span className={styles.companySwitcherName}>
                    {candidate.name}
                  </span>
                  <span className={styles.companySwitcherRole}>
                    {companyRoleLabel(candidate.role)}
                  </span>
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.companySwitcherEmpty}>{emptyMessage}</p>
      )}
    </section>
  );
}

export function CompanySettingsScreen({
  initialCompany,
  initialCompanies,
  canManageTeam = false,
  initialCompanyId,
}: Props) {
  const teamCopy = getCompanyTeamCopy(useWorkspaceLocale());
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const deleteConfirmationRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<RecruiterCompanySettings[]>(
    initialCompanies?.length
      ? initialCompanies
      : initialCompany
        ? [initialCompany]
        : [],
  );
  const [company, setCompany] = useState(initialCompany);
  const { selectedCompanyId, setCompanyId } =
    useRecruiterCompanyScope(companies);
  const [explicitCompanyId, setExplicitCompanyId] = useState(
    initialCompanyId ?? null,
  );
  const [form, setForm] = useState<FormState>(
    initialCompany ? formFromCompany(initialCompany) : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isEditing, setIsEditing] = useState(!initialCompany?.profileComplete);

  const activeCompanyId =
    explicitCompanyId ??
    selectedCompanyId ??
    company?.id ??
    companies[0]?.id ??
    null;

  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === company?.id) return;
    const nextCompany = companies.find((item) => item.id === activeCompanyId);
    if (!nextCompany) return;
    // Synchronize the editable form with the company selected in the shared
    // workspace scope. This is intentionally a state transition from the
    // external company selector into this screen's local form state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompany(nextCompany);
    setForm(formFromCompany(nextCompany));
    setIsEditing(!nextCompany.profileComplete);
    setMessage("");
    setError("");
    setFieldErrors({});
  }, [activeCompanyId, companies, company?.id]);

  useLayoutEffect(() => {
    if (isEditing && descriptionRef.current) {
      resizeDescription(descriptionRef.current);
    }
  }, [form.description, isEditing]);

  useEffect(() => {
    if (!deleteDialogOpen) return;
    deleteConfirmationRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteBusy) {
        setDeleteDialogOpen(false);
        setDeleteConfirmation("");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteBusy, deleteDialogOpen]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    setError("");
    setMessage("");
    try {
      const logo = await optimizeLogo(file);
      updateField("logo", logo);
      setMessage("Logo preview ready. Save the profile to upload it.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The logo could not be uploaded.",
      );
      setFieldErrors((current) => ({
        ...current,
        logo: "Choose a valid image file.",
      }));
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateForm(form);
    setFieldErrors(errors);
    setMessage("");
    setError("");
    if (Object.keys(errors).length) {
      setError("Complete the required company profile fields before saving.");
      const firstField = Object.keys(errors)[0];
      document.getElementById(`company-${firstField}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const companyQuery = company?.id
        ? `?companyId=${encodeURIComponent(company.id)}`
        : "";
      const response = await fetch(`/api/recruiter/company${companyQuery}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
        },
        body: JSON.stringify(form),
      });
      const payload =
        (await response.json()) as Partial<RecruiterCompanySettings> & {
          message?: string;
          fieldErrors?: FieldErrors;
        };
      if (!response.ok || !payload.id) {
        setFieldErrors(payload.fieldErrors ?? {});
        throw new Error(payload.message ?? "Unable to save company settings.");
      }
      const savedCompany = payload as RecruiterCompanySettings;
      setCompany(savedCompany);
      setCompanies((current) =>
        current.some((item) => item.id === savedCompany.id)
          ? current.map((item) =>
              item.id === savedCompany.id ? savedCompany : item,
            )
          : [...current, savedCompany],
      );
      setForm(formFromCompany(savedCompany));
      setMessage("Company profile saved.");
      setIsEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save company settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openDeleteDialog() {
    if (!company || busy || deleteBusy) return;
    setDeleteConfirmation("");
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    if (deleteBusy) return;
    setDeleteDialogOpen(false);
    setDeleteConfirmation("");
  }

  async function deleteCompany() {
    const selectedCompany = company;
    if (!selectedCompany || busy || deleteBusy) return;
    if (deleteConfirmation.trim() !== selectedCompany.name.trim()) return;

    setDeleteBusy(true);
    setMessage("");
    setError("");
    setFieldErrors({});
    try {
      const companyQuery = `?companyId=${encodeURIComponent(selectedCompany.id)}`;
      const response = await fetch(`/api/recruiter/company${companyQuery}`, {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfProof },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        deleted?: boolean;
        message?: string;
      };
      if (!response.ok || !payload.deleted) {
        throw new Error(payload.message ?? "Unable to delete company.");
      }

      window.dispatchEvent(new Event(RECRUITER_AUTHORITY_CHANGED_EVENT));

      const remainingCompanies = companies.filter(
        (candidate) => candidate.id !== selectedCompany.id,
      );
      const nextCompany = remainingCompanies[0] ?? null;
      setCompanies(remainingCompanies);
      setCompany(nextCompany);
      setExplicitCompanyId(nextCompany?.id ?? null);
      setCompanyId(nextCompany?.id ?? ALL_RECRUITER_COMPANIES);
      setForm(nextCompany ? formFromCompany(nextCompany) : emptyForm());
      setIsEditing(nextCompany ? !nextCompany.profileComplete : false);
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
      setMessage(nextCompany ? "Company deleted." : "");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to delete company.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!company) {
    return (
      <section className={styles.emptySection}>
        <p className={styles.eyebrow}>COMPANY SETTINGS</p>
        <h1>No company is linked yet</h1>
        <p>
          Complete recruiter verification first. After approval, this screen
          will be linked to the company you are authorized to manage.
        </p>
        <Link
          className={styles.btnSave}
          href="/dashboard/employer-verification"
        >
          Create a Company
        </Link>
      </section>
    );
  }

  const profileValidation = getCompanyProfileValidation(form);
  const missingFields = profileValidation.missingFields;
  const profileComplete = missingFields.length === 0;
  const status = company.verificationStatus;
  const managesSelectedTeam = company.role
    ? company.role === "OWNER"
    : canManageTeam;
  const canDeleteCompany = company.role
    ? company.role === "OWNER"
    : canManageTeam;
  const ownedCompanies = companies.filter(
    (candidate) => candidate.role === "OWNER",
  );
  const memberCompanies = companies.filter(
    (candidate) => candidate.role !== "OWNER",
  );
  const ownershipLimitReached =
    ownedCompanies.length >= MAX_OWNED_COMPANIES_PER_USER;

  return (
    <section className={styles.wrap}>
      <section
        className={styles.companySwitcher}
        aria-labelledby="company-switcher-title"
      >
        <div className={styles.companySwitcherHeader}>
          <div>
            <p className={styles.switcherLabel} id="company-switcher-title">
              Your companies
            </p>
            <p className={styles.switcherHint}>
              Switch the company profile and team context shown below.
            </p>
          </div>
          <Link
            className={styles.createCompanyLink}
            href="/dashboard/employer-verification"
          >
            Add or join a company
          </Link>
        </div>
        <p className={styles.companySwitcherNote} role="status">
          {ownershipLimitReached
            ? `Ownership limit reached (${MAX_OWNED_COMPANIES_PER_USER}/${MAX_OWNED_COMPANIES_PER_USER}). You can still join companies as a Recruiter or HR Manager.`
            : `You own ${ownedCompanies.length}/${MAX_OWNED_COMPANIES_PER_USER} companies. Joining a company as a Recruiter or HR Manager does not use an ownership slot.`}
        </p>
        <CompanySwitcherGroup
          title="Owned by you"
          description="You can manage the profile, team, and company settings."
          countLabel={`${ownedCompanies.length}/${MAX_OWNED_COMPANIES_PER_USER} slots`}
          companies={ownedCompanies}
          activeCompanyId={company.id}
          emptyMessage="You do not own a company yet."
          onSelect={(companyId) => {
            setExplicitCompanyId(null);
            setCompanyId(companyId);
          }}
        />
        <CompanySwitcherGroup
          title="Member access"
          description="Companies that invited you as a recruiter or manager."
          countLabel={`${memberCompanies.length} linked`}
          companies={memberCompanies}
          activeCompanyId={company.id}
          emptyMessage="No other company access yet."
          onSelect={(companyId) => {
            setExplicitCompanyId(null);
            setCompanyId(companyId);
          }}
        />
      </section>
      <div className={styles.phead}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            COMPANY SETTINGS
          </p>
          <h1 className={styles.ptitle}>{company.name}</h1>
          {company.entityType ? (
            <span className={styles.legalType}>{company.entityType}</span>
          ) : null}
          <p className={styles.psub}>
            Keep the company identity used by your job postings and
            candidate-facing cards up to date.
          </p>
        </div>
        <span className={statusClass(status)}>
          <span aria-hidden="true">{statusIcon(status)}</span>
          Verification: {statusLabel(status)}
        </span>
      </div>

      <section className={styles.identityCard} aria-labelledby="identity-title">
        <p className={styles.identityLabel} id="identity-title">
          Verified identity
        </p>
        <div className={styles.identityGrid}>
          <div className={styles.lockedField}>
            <label htmlFor="company-identity-name">Company name</label>
            <div className={styles.lockedBox} id="company-identity-name">
              <span>{company.name}</span>
              <span className={styles.lock} aria-label="Locked">
                <LockIcon />
              </span>
            </div>
          </div>
          <div className={styles.lockedField}>
            <label htmlFor="company-identity-tax-code">Tax code</label>
            <div className={styles.lockedBox} id="company-identity-tax-code">
              <span>{company.taxCode}</span>
              <span className={styles.lock} aria-label="Locked">
                <LockIcon />
              </span>
            </div>
          </div>
        </div>
        <p className={styles.identityNote}>
          These details are locked after verification and cannot be edited here.
          <Link href="/support">Request a change through Support →</Link>
        </p>
      </section>

      {!profileComplete ? (
        <section
          className={styles.gateCard}
          role="alert"
          aria-labelledby="profile-complete-title"
        >
          <p className={styles.gateLabel}>Posting gate</p>
          <h2 className={styles.gateTitle} id="profile-complete-title">
            Complete your company profile before posting a job
          </h2>
          <p className={styles.gateSub}>
            The Create job posting action stays locked until these fields are
            complete.
          </p>
          <ul className={styles.gateChecklist}>
            {missingFields.map((field) => (
              <li className={styles.gateItem} key={field}>
                <span className={styles.gi} aria-hidden="true">
                  !
                </span>
                <span>
                  {profileFields.find((item) => item.key === field)?.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={styles.grid}>
        {isEditing ? (
          <form className={styles.formCard} onSubmit={save} noValidate>
            <p className={styles.formHint}>
              Fields marked * are required. A company logo is required before a
              job can be posted.
            </p>

            <div className={styles.formRow}>
              <div
                className={fieldClass(
                  Boolean(
                    fieldErrors.industry ??
                    profileValidation.fieldErrors.industry,
                  ),
                )}
              >
                <label htmlFor="company-industry">Industry *</label>
                <input
                  id="company-industry"
                  value={form.industry}
                  onChange={(event) =>
                    updateField("industry", event.target.value)
                  }
                  aria-invalid={Boolean(
                    fieldErrors.industry ??
                    profileValidation.fieldErrors.industry,
                  )}
                  aria-describedby={
                    (fieldErrors.industry ??
                    profileValidation.fieldErrors.industry)
                      ? "company-industry-error"
                      : undefined
                  }
                  placeholder="e.g. Information Technology"
                  maxLength={160}
                />
                <FieldError
                  id="company-industry-error"
                  message={
                    fieldErrors.industry ??
                    profileValidation.fieldErrors.industry
                  }
                />
              </div>
              <div
                className={fieldClass(
                  Boolean(
                    fieldErrors.size ?? profileValidation.fieldErrors.size,
                  ),
                )}
              >
                <label htmlFor="company-size">Company size *</label>
                <input
                  id="company-size"
                  value={form.size}
                  onChange={(event) => updateField("size", event.target.value)}
                  aria-invalid={Boolean(
                    fieldErrors.size ?? profileValidation.fieldErrors.size,
                  )}
                  aria-describedby={
                    (fieldErrors.size ?? profileValidation.fieldErrors.size)
                      ? "company-size-error"
                      : undefined
                  }
                  placeholder="e.g. 200–500 employees"
                  maxLength={80}
                />
                <FieldError
                  id="company-size-error"
                  message={
                    fieldErrors.size ?? profileValidation.fieldErrors.size
                  }
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="company-founded-year">Founded year</label>
              <input
                id="company-founded-year"
                type="number"
                min={1800}
                max={2200}
                value={form.foundedYear ?? ""}
                onChange={(event) =>
                  updateField(
                    "foundedYear",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                aria-describedby="company-founded-year-help"
                placeholder="e.g. 2012"
              />
              <p id="company-founded-year-help" className={styles.formHint}>
                Optional public information shown on the Candidate Company page.
              </p>
            </div>

            <div className={styles.field}>
              <label htmlFor="company-website">Website</label>
              <input
                id="company-website"
                type="url"
                value={form.website ?? ""}
                onChange={(event) =>
                  updateField("website", event.target.value || null)
                }
                aria-invalid={Boolean(fieldErrors.website)}
                aria-describedby={
                  fieldErrors.website ? "company-website-error" : undefined
                }
                placeholder="https://example.com"
              />
              <FieldError
                id="company-website-error"
                message={fieldErrors.website}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.logoLabel}>Company logo *</span>
              <p className={styles.formHint}>
                PNG, JPEG, or WebP. The image is resized before upload.
              </p>
              <div className={styles.logoUpload}>
                <div className={styles.logoPreview}>
                  {form.logo ? (
                    <Image
                      src={form.logo}
                      alt="Company logo preview"
                      width={128}
                      height={128}
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden="true">LOGO</span>
                  )}
                </div>
                <div className={styles.logoActions}>
                  <input
                    ref={fileInputRef}
                    id="company-logo-file"
                    className={styles.logoFileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void selectLogo(event)}
                  />
                  <div className={styles.logoButtons}>
                    <label
                      className={styles.btnOutline}
                      htmlFor="company-logo-file"
                    >
                      {logoBusy
                        ? "Preparing logo..."
                        : form.logo
                          ? "Choose another logo"
                          : "Choose logo"}
                    </label>
                    <button
                      className={`${styles.btnOutline} ${styles.muted}`}
                      type="button"
                      disabled={!form.logo || logoBusy || busy}
                      onClick={() => updateField("logo", null)}
                    >
                      Remove logo
                    </button>
                  </div>
                </div>
              </div>
              <FieldError
                id="company-logo-error"
                message={fieldErrors.logo ?? profileValidation.fieldErrors.logo}
              />
            </div>

            <div
              className={fieldClass(
                Boolean(
                  fieldErrors.address ?? profileValidation.fieldErrors.address,
                ),
              )}
            >
              <label htmlFor="company-address">Address *</label>
              <input
                id="company-address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                aria-invalid={Boolean(
                  fieldErrors.address ?? profileValidation.fieldErrors.address,
                )}
                aria-describedby={
                  (fieldErrors.address ?? profileValidation.fieldErrors.address)
                    ? "company-address-error"
                    : undefined
                }
                placeholder="Street, district, city"
                maxLength={300}
              />
              <FieldError
                id="company-address-error"
                message={
                  fieldErrors.address ?? profileValidation.fieldErrors.address
                }
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="company-description">Description</label>
              <textarea
                ref={descriptionRef}
                id="company-description"
                value={form.description ?? ""}
                onChange={(event) => {
                  resizeDescription(event.currentTarget);
                  updateField("description", event.target.value || null);
                }}
                placeholder="Introduce your company briefly..."
                maxLength={3000}
                rows={5}
              />
            </div>

            <div className={styles.formActions}>
              <p
                className={`${styles.formStatus}${error ? ` ${styles.isError}` : ""}`}
                role={error ? "alert" : "status"}
                aria-live="polite"
              >
                {error || message}
              </p>
              <button
                className={styles.btnSave}
                type="submit"
                disabled={busy || logoBusy}
              >
                {busy ? "Saving..." : "Save company profile"}
              </button>
            </div>
          </form>
        ) : (
          <section
            className={styles.formCard}
            aria-labelledby="company-profile-summary-title"
          >
            <div className={styles.readonlyHeader}>
              <div>
                <p className={styles.formHint}>Saved company profile</p>
                <h2
                  className={styles.readonlyTitle}
                  id="company-profile-summary-title"
                >
                  Your public company information
                </h2>
              </div>
              <span className={styles.savedBadge}>Saved</span>
            </div>

            <div className={styles.readonlyGrid}>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Industry</span>
                <span className={styles.readonlyValue}>
                  {company.industry || "Not provided"}
                </span>
              </div>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Company size</span>
                <span className={styles.readonlyValue}>
                  {company.size || "Not provided"}
                </span>
              </div>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Founded year</span>
                <span className={styles.readonlyValue}>
                  {company.foundedYear ?? "Not provided"}
                </span>
              </div>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Website</span>
                <span className={styles.readonlyValue}>
                  {company.website || "Not provided"}
                </span>
              </div>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Address</span>
                <span className={styles.readonlyValue}>
                  {company.address || "Not provided"}
                </span>
              </div>
              <div className={styles.readonlyItem}>
                <span className={styles.readonlyLabel}>Company logo</span>
                <div className={styles.readonlyLogo}>
                  {company.logo ? (
                    <Image
                      src={company.logo}
                      alt="Company logo"
                      width={64}
                      height={64}
                      unoptimized
                    />
                  ) : (
                    <span>LOGO</span>
                  )}
                </div>
              </div>
              <div className={`${styles.readonlyItem} ${styles.readonlyWide}`}>
                <span className={styles.readonlyLabel}>Description</span>
                <span className={styles.readonlyValue}>
                  {company.description || "Not provided"}
                </span>
              </div>
            </div>

            <div className={styles.readonlyActions}>
              <p
                className={`${styles.formStatus}${error ? ` ${styles.isError}` : ""}`}
                role={error ? "alert" : "status"}
                aria-live="polite"
              >
                {error ||
                  message ||
                  "Your saved details are currently read-only."}
              </p>
              <button
                className={styles.btnEdit}
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setMessage("");
                  setError("");
                  setFieldErrors({});
                }}
              >
                Edit company profile
              </button>
            </div>
          </section>
        )}

        <aside className={styles.sideCard}>
          <div>
            <p className={styles.sideLabel}>Ownership</p>
            <h2 className={styles.sideTitle}>Authorized recruiters</h2>
            <p className={styles.sideDesc}>
              Only the owner and listed members can manage this company&apos;s
              job postings.
            </p>
          </div>

          <div className={styles.sideRow}>
            <div className={styles.srl}>Owner</div>
            <div className={styles.srv}>
              {company.ownerUserId ? "Authorized owner" : "Unclaimed"}
            </div>
          </div>
          <div className={styles.sideRow}>
            <div className={styles.srl}>Members</div>
            <div className={styles.srv}>{company.memberUserIds.length}</div>
          </div>
          {managesSelectedTeam ? (
            <div className={styles.sideActions}>
              <Link
                className={styles.btnOutline}
                href={`/recruiter/company-settings/team?companyId=${encodeURIComponent(company.databaseId ?? company.id)}`}
              >
                {teamCopy.manageTeam}
              </Link>
              <Link
                className={styles.btnOutline}
                href={`/recruiter/company-settings/team/applications?companyId=${encodeURIComponent(company.databaseId ?? company.id)}`}
              >
                {teamCopy.teamApplications}
              </Link>
            </div>
          ) : (
            <p className={styles.sideNote}>
              Only the active company owner can manage team members.
            </p>
          )}
          {canDeleteCompany ? (
            <div className={styles.dangerZone}>
              <p className={styles.dangerLabel}>Danger zone</p>
              <p className={styles.dangerText}>
                Permanently delete this company and all of its jobs,
                applications, messages, and analytics. This cannot be undone.
              </p>
              <button
                className={styles.btnDelete}
                type="button"
                disabled={busy || logoBusy || deleteBusy}
                onClick={openDeleteDialog}
              >
                Delete company
              </button>
            </div>
          ) : null}
        </aside>
      </div>
      {deleteDialogOpen ? (
        <div
          className={styles.deleteDialogBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <section
            className={styles.deleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-company-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.deleteDialogHeader}>
              <div>
                <p className={styles.dangerLabel}>Danger zone</p>
                <h2 id="delete-company-title">Delete {company.name}?</h2>
              </div>
              <button
                className={styles.deleteDialogClose}
                type="button"
                aria-label="Close delete dialog"
                disabled={deleteBusy}
                onClick={closeDeleteDialog}
              >
                ×
              </button>
            </div>
            <p className={styles.deleteDialogText}>
              This permanently removes the company and its recruiter data,
              including job postings, applications, messages, and analytics.
            </p>
            <label className={styles.deleteConfirmationLabel}>
              Type <strong>{company.name}</strong> to confirm
              <input
                ref={deleteConfirmationRef}
                className={styles.deleteConfirmationInput}
                type="text"
                value={deleteConfirmation}
                aria-label="Type company name to confirm"
                autoComplete="off"
                disabled={deleteBusy}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </label>
            <div className={styles.deleteDialogActions}>
              <button
                className={styles.btnCancelDelete}
                type="button"
                disabled={deleteBusy}
                onClick={closeDeleteDialog}
              >
                Cancel
              </button>
              <button
                className={styles.btnDeleteConfirm}
                type="button"
                disabled={
                  deleteBusy ||
                  deleteConfirmation.trim() !== company.name.trim()
                }
                onClick={() => void deleteCompany()}
              >
                {deleteBusy ? "Deleting..." : "Delete company"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
