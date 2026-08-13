"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Badge } from "@/frontend/components/ui/badge";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import {
  companyLogoSchema,
  type RecruiterCompanySettings,
  type RecruiterCompanySettingsInput,
} from "@/shared/contracts/jobs/catalog";

type Props = { initialCompany: RecruiterCompanySettings | null };
type FormState = RecruiterCompanySettingsInput;
type FieldName = "name" | "industry" | "size" | "address" | "logo";
type FieldErrors = Partial<Record<FieldName | "website", string>>;

const MAX_LOGO_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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
  };
}

function statusTone(status: RecruiterCompanySettings["verificationStatus"]) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "error" as const;
  return "warning" as const;
}

function statusLabel(status: RecruiterCompanySettings["verificationStatus"]) {
  return status === "approved"
    ? "Approved"
    : status === "rejected"
      ? "Rejected"
      : "Pending";
}

type ProfileValidation = {
  missingFields: FieldName[];
  fieldErrors: Partial<Record<FieldName, string>>;
};

export function getCompanyProfileValidation(form: FormState): ProfileValidation {
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
        value: key === "logo" ? (form[key] ? "[uploaded logo]" : null) : form[key],
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
    reader.onerror = () => reject(new Error("The selected logo could not be read."));
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
    loaded.onerror = () => reject(new Error("The selected logo could not be decoded."));
    loaded.src = source;
  });
  const maxDimension = 512;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The logo preview is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.86);
  const result = webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", 0.86);
  if (result.length > 1_100_000) {
    throw new Error("Choose a simpler logo image under 800 KB after compression.");
  }
  return result;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <small className="recruiter-field-error" id={id} role="alert">
      {message}
    </small>
  ) : null;
}

export function CompanySettingsScreen({ initialCompany }: Props) {
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(initialCompany);
  const [form, setForm] = useState<FormState>(
    initialCompany
      ? formFromCompany(initialCompany)
      : {
          name: "",
          logo: null,
          size: "",
          industry: "",
          address: "",
          website: null,
          description: null,
        },
  );
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
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
      setError(caught instanceof Error ? caught.message : "The logo could not be uploaded.");
      setFieldErrors((current) => ({ ...current, logo: "Choose a valid image file." }));
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
      const response = await fetch("/api/recruiter/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfProof,
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as Partial<RecruiterCompanySettings> & {
        message?: string;
        fieldErrors?: FieldErrors;
      };
      if (!response.ok || !payload.id) {
        setFieldErrors(payload.fieldErrors ?? {});
        throw new Error(payload.message ?? "Unable to save company settings.");
      }
      const savedCompany = payload as RecruiterCompanySettings;
      setCompany(savedCompany);
      setForm(formFromCompany(savedCompany));
      setMessage("Company profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save company settings.");
    } finally {
      setBusy(false);
    }
  }

  if (!company) {
    return (
      <section className="recruiter-empty-state recruiter-surface-card recruiter-company-required">
        <p className="recruiter-eyebrow">COMPANY SETTINGS</p>
        <h1>No company is linked yet</h1>
        <p>
          Complete recruiter verification first. After approval, this screen will be linked to the company you are authorized to manage.
        </p>
        <Link className="recruiter-primary-button" href="/dashboard/employer-verification">
          Start recruiter verification
        </Link>
      </section>
    );
  }

  const profileValidation = getCompanyProfileValidation(form);
  const missingFields = profileValidation.missingFields;
  const profileComplete = missingFields.length === 0;

  return (
    <section className="recruiter-management recruiter-company-settings">
      <div className="recruiter-management__heading">
        <div>
          <p className="recruiter-eyebrow">COMPANY SETTINGS</p>
          <h1>{company.name}</h1>
          <p>Keep the company identity used by your job postings and candidate-facing cards up to date.</p>
        </div>
        <Badge tone={statusTone(company.verificationStatus)}>
          Verification: {statusLabel(company.verificationStatus)}
        </Badge>
      </div>

      {!profileComplete ? (
        <section className="recruiter-company-settings__profile-alert" role="alert" aria-labelledby="profile-complete-title">
          <div>
            <p className="recruiter-eyebrow">POSTING GATE</p>
            <h2 id="profile-complete-title">Complete your company profile before posting a job</h2>
            <p>The Create job posting action stays locked until these fields are complete.</p>
          </div>
          <ul>
            {missingFields.map((field) => (
              <li key={field}>
                {profileFields.find((item) => item.key === field)?.label}: {profileValidation.fieldErrors[field]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="recruiter-company-settings__grid">
        <form className="recruiter-editor__form recruiter-surface-card" onSubmit={save} noValidate>
          <p className="recruiter-required-note">Fields marked * are required. A company logo is required before a job can be posted.</p>
          <div className="recruiter-form-grid">
            <label htmlFor="company-name">
              Company name *
              <input id="company-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "company-name-error" : undefined} maxLength={160} />
              <FieldError id="company-name-error" message={fieldErrors.name ?? profileValidation.fieldErrors.name} />
            </label>
            <label htmlFor="company-industry">
              Industry *
              <input id="company-industry" value={form.industry} onChange={(event) => updateField("industry", event.target.value)} aria-invalid={Boolean(fieldErrors.industry)} aria-describedby={fieldErrors.industry ? "company-industry-error" : undefined} maxLength={160} />
              <FieldError id="company-industry-error" message={fieldErrors.industry ?? profileValidation.fieldErrors.industry} />
            </label>
          </div>
          <div className="recruiter-form-grid">
            <label htmlFor="company-size">
              Company size *
              <input id="company-size" value={form.size} onChange={(event) => updateField("size", event.target.value)} aria-invalid={Boolean(fieldErrors.size)} aria-describedby={fieldErrors.size ? "company-size-error" : undefined} maxLength={80} />
              <FieldError id="company-size-error" message={fieldErrors.size ?? profileValidation.fieldErrors.size} />
            </label>
            <label htmlFor="company-website">
              Website
              <input id="company-website" type="url" value={form.website ?? ""} onChange={(event) => updateField("website", event.target.value || null)} aria-invalid={Boolean(fieldErrors.website)} aria-describedby={fieldErrors.website ? "company-website-error" : undefined} placeholder="https://example.com" />
              <FieldError id="company-website-error" message={fieldErrors.website} />
            </label>
          </div>
          <div className="recruiter-company-logo-field">
            <div>
              <span className="recruiter-form-label">Company logo *</span>
              <p className="recruiter-required-note">PNG, JPEG, or WebP. The image is resized before upload.</p>
            </div>
            <div className="recruiter-company-logo-editor">
              <div className="recruiter-company-logo-preview">
                {form.logo ? (
                  <Image src={form.logo} alt="Company logo preview" width={128} height={128} unoptimized />
                ) : (
                  <span aria-hidden="true">LOGO</span>
                )}
              </div>
              <div className="recruiter-company-logo-actions">
                <input ref={fileInputRef} id="company-logo-file" className="recruiter-company-logo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void selectLogo(event)} />
                <label className="recruiter-outline-button" htmlFor="company-logo-file">
                  {logoBusy ? "Preparing logo..." : form.logo ? "Choose another logo" : "Choose logo"}
                </label>
                <button className="recruiter-outline-button" type="button" disabled={!form.logo || logoBusy || busy} onClick={() => updateField("logo", null)}>
                  Remove logo
                </button>
                <FieldError id="company-logo-error" message={fieldErrors.logo ?? profileValidation.fieldErrors.logo} />
              </div>
            </div>
          </div>
          <label htmlFor="company-address">
            Address *
            <input id="company-address" value={form.address} onChange={(event) => updateField("address", event.target.value)} aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "company-address-error" : undefined} maxLength={300} />
            <FieldError id="company-address-error" message={fieldErrors.address ?? profileValidation.fieldErrors.address} />
          </label>
          <label htmlFor="company-description">
            Description
            <textarea id="company-description" value={form.description ?? ""} onChange={(event) => updateField("description", event.target.value || null)} maxLength={3000} rows={6} />
          </label>
          <div className="recruiter-editor__actions">
            <p className={`recruiter-required-note ${error ? "is-error" : ""}`} role={error ? "alert" : "status"} aria-live="polite">{error || message}</p>
            <button className="recruiter-primary-button" type="submit" disabled={busy || logoBusy}>
              {busy ? "Saving..." : "Save company profile"}
            </button>
          </div>
        </form>

        <aside className="recruiter-surface-card recruiter-company-settings__details">
          <div>
            <p className="recruiter-eyebrow">OWNERSHIP</p>
            <h2>Authorized recruiters</h2>
            <p className="recruiter-required-note">Only the owner and listed members can manage this company job postings.</p>
          </div>
          <dl>
            <div><dt>Verification</dt><dd><Badge tone={statusTone(company.verificationStatus)}>{statusLabel(company.verificationStatus)}</Badge></dd></div>
            <div><dt>Tax code</dt><dd>{company.taxCode}</dd></div>
            <div><dt>Owner</dt><dd>{company.ownerUserId ?? "Unclaimed"}</dd></div>
            <div><dt>Members</dt><dd>{company.memberUserIds.length}</dd></div>
          </dl>
          <p className="recruiter-required-note">Team invitations and member removal will be added after the approval workflow UI is exposed to admins.</p>
        </aside>
      </div>
    </section>
  );
}
