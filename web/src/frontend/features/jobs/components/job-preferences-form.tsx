"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Check,
  Plane,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
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

function formatSalaryInput(value: string, locale: "vi" | "en") {
  const digits = value.replace(/[^\d]/gu, "");
  return digits
    ? new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(
        Number(digits),
      )
    : "";
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
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          consentRequired:
            "Bạn cần đồng ý phân tích bằng AI trước khi SmartHire có thể gợi ý việc làm.",
          reviewInput: "Vui lòng kiểm tra lại thông tin đã nhập.",
          updateFailed: "Không thể cập nhật nhu cầu việc làm.",
          updated: "Đã cập nhật nhu cầu việc làm.",
          bannerTitle: "Nhận các cơ hội phù hợp với bạn",
          bannerDescription:
            "Cho SmartHire biết công việc bạn mong muốn để nhận gợi ý phù hợp hơn.",
          privacy: "Riêng tư cho bạn",
          required: "Thông tin bắt buộc",
          personal: "Thông tin cá nhân",
          gender: "Giới tính",
          female: "Nữ",
          male: "Nam",
          undisclosed: "Không muốn tiết lộ",
          jobNeeds: "Nhu cầu việc làm",
          professionalPosition: "Vị trí chuyên môn",
          professionalPositionPlaceholder: "Tìm vị trí chuyên môn",
          customPosition: "Vị trí khác",
          customPositionPlaceholder:
            "Tìm hoặc thêm vị trí chưa có trong danh mục",
          customPositionHelper: "Có thể thêm tối đa 5 vị trí khác.",
          skills: "Kỹ năng",
          skillsPlaceholder: "Tìm kỹ năng",
          experience: "Kinh nghiệm",
          desiredSalary: "Mức lương mong muốn",
          locations: "Tỉnh/Thành phố (trước 01/07/2025)",
          locationsPlaceholder: "Tìm tỉnh hoặc thành phố",
          relocation: "Tôi sẵn sàng chuyển nơi ở",
          consent: "Đồng ý & quyền cho phép",
          aiConsent:
            "Tôi đồng ý để SmartHire sử dụng phân tích AI dựa trên CV và hoạt động tìm việc để gợi ý công việc.",
          aiConsentDescription:
            "Bật đối sánh CV rõ ràng, nhất quán và phù hợp hơn.",
          notificationConsent:
            "Tôi đồng ý để SmartHire gửi thông tin về việc làm và sự kiện nghề nghiệp.",
          notificationConsentDescription:
            "Nhận cơ hội được tuyển chọn qua thông báo và email tổng hợp.",
          discard: "Huỷ thay đổi",
          updating: "Đang cập nhật…",
          update: "Cập nhật",
          experienceLabels: {
            no_experience: "Chưa có kinh nghiệm",
            under_1_year: "Dưới 1 năm",
            "1_3_years": "1–3 năm",
            "3_5_years": "3–5 năm",
            "5_plus_years": "Trên 5 năm",
          },
        }
      : {
          consentRequired:
            "AI-analysis consent is required before SmartHire can recommend jobs.",
          reviewInput: "Please review the information you entered.",
          updateFailed: "Could not update job preferences.",
          updated: "Job preferences updated.",
          bannerTitle: "Get matched to relevant opportunities",
          bannerDescription:
            "Tell us what you want next so SmartHire can surface better matches.",
          privacy: "Private to you",
          required: "Required information",
          personal: "Personal information",
          gender: "Gender",
          female: "Female",
          male: "Male",
          undisclosed: "Prefer not to say",
          jobNeeds: "Job needs",
          professionalPosition: "Professional Position",
          professionalPositionPlaceholder: "Search professional positions",
          customPosition: "Custom Position",
          customPositionPlaceholder:
            "Search or add a position not in the category list",
          customPositionHelper: "Add up to 5 custom positions.",
          skills: "Skills",
          skillsPlaceholder: "Search skills",
          experience: "Experience",
          desiredSalary: "Desired Salary",
          locations: "Province/City (pre 7/1/2025)",
          locationsPlaceholder: "Search provinces or cities",
          relocation: "I'm open to relocating",
          consent: "Consent & Permissions",
          aiConsent:
            "I agree to let SmartHire recommend jobs based on my CV and job-search activity, using AI-based analysis.",
          aiConsentDescription:
            "Enables high-precision deterministic and qualitative CV matching.",
          notificationConsent:
            "I agree to let SmartHire send me information about jobs and career events.",
          notificationConsentDescription:
            "Receive curated opportunities via notification & email digest.",
          discard: "Discard changes",
          updating: "Updating…",
          update: "Update",
          experienceLabels: {
            no_experience: "No experience",
            under_1_year: "Under 1 year",
            "1_3_years": "1–3 years",
            "3_5_years": "3–5 years",
            "5_plus_years": "5+ years",
          },
        };
  const [form, setForm] = useState(() => toFormState(initialPreferences));
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!form.aiAnalysisConsent) {
      setError(copy.consentRequired);
      return;
    }
    const parsed = jobPreferencesSchema.safeParse({
      ...form,
      desiredSalaryMin:
        Number(form.desiredSalaryMin.replace(/[^\d]/gu, "")) || 0,
    });
    if (!parsed.success) {
      setError(copy.reviewInput);
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
          typeof body?.message === "string" ? body.message : copy.updateFailed,
        );
      }
      setStatus(copy.updated);
      router.push("/jobs/matches");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.updateFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="job-preferences-banner">
        <span className="job-preferences-banner-icon" aria-hidden="true">
          <Sparkles />
        </span>
        <div className="job-preferences-banner-copy">
          <strong>{copy.bannerTitle}</strong>
          <p>{copy.bannerDescription}</p>
        </div>
        <span className="job-preferences-privacy">
          <ShieldCheck aria-hidden="true" />
          {copy.privacy}
        </span>
      </div>
      <p className="job-preferences-required">
        <span>*</span> {copy.required}
      </p>
      <form
        className="job-preferences-form"
        onSubmit={(event) => void submit(event)}
      >
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

        <section className="job-preferences-card" aria-labelledby="personal-information-heading">
          <h2 id="personal-information-heading" className="job-preferences-card-title">
            <UserRound aria-hidden="true" />
            {copy.personal}
          </h2>
          <div className="preference-field">
            <span className="preference-label">{copy.gender}</span>
            <div className="preference-radio-group">
              {[
                ["female", copy.female],
                ["male", copy.male],
                ["undisclosed", copy.undisclosed],
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
        </section>

        <section className="job-preferences-card job-preferences-card--needs" aria-labelledby="job-needs-heading">
          <h2 id="job-needs-heading" className="job-preferences-card-title">
            <Briefcase aria-hidden="true" />
            {copy.jobNeeds}
          </h2>
          <div className="preference-field">
            <SearchableChipSelect
              id="professional-positions"
              label={copy.professionalPosition}
              placeholder={copy.professionalPositionPlaceholder}
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
              label={copy.customPosition}
              placeholder={copy.customPositionPlaceholder}
              options={[]}
              selectedValues={form.customPositions}
              maximum={5}
              allowCustom
              helperText={copy.customPositionHelper}
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
              label={copy.skills}
              placeholder={copy.skillsPlaceholder}
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
              {copy.experience} <span>*</span>
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
                  {copy.experienceLabels[option.value]}
                </option>
              ))}
            </select>
          </div>

          <div className="preference-field">
            <label className="preference-label" htmlFor="desired-salary">
              {copy.desiredSalary} <span>*</span>
            </label>
            <div className="preference-input-suffix">
              <input
                id="desired-salary"
                inputMode="numeric"
                value={formatSalaryInput(form.desiredSalaryMin, locale)}
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
              label={copy.locations}
              placeholder={copy.locationsPlaceholder}
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
          <label className="preference-relocation">
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
            <Plane aria-hidden="true" />
            <span>{copy.relocation}</span>
            <span className="preference-relocation-switch" aria-hidden="true" />
          </label>
        </section>

        <section className="job-preferences-card job-preferences-card--consent" aria-labelledby="consent-heading">
          <h2 id="consent-heading" className="job-preferences-card-title">
            <ShieldCheck aria-hidden="true" />
            {copy.consent}
          </h2>
          <label className="preference-checkbox preference-consent-row">
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
            <div>
              <strong>
                {copy.aiConsent} <em>*</em>
              </strong>
              <small>{copy.aiConsentDescription}</small>
            </div>
          </label>
          <label className="preference-checkbox preference-consent-row">
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
            <div>
              <strong>{copy.notificationConsent}</strong>
              <small>{copy.notificationConsentDescription}</small>
            </div>
          </label>
        </section>

        <div className="job-preferences-actions">
          <button
            className="job-preferences-discard"
            type="button"
            disabled={pending}
            onClick={() => {
              setForm(toFormState(initialPreferences));
              setError("");
              setStatus("");
            }}
          >
            {copy.discard}
          </button>
          <button
            className="dashboard-hero-cta"
            type="submit"
            disabled={pending}
          >
            <Check aria-hidden="true" />
            {pending ? copy.updating : copy.update}
          </button>
        </div>
      </form>
    </>
  );
}
