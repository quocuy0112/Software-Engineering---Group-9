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

type TagField = "customPositions" | "skills" | "workLocations";
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
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
}

export function JobPreferencesForm({
  initialPreferences,
  positionOptions,
  skillOptions,
}: {
  initialPreferences: JobPreferences;
  positionOptions: JobPositionOption[];
  skillOptions: string[];
}) {
  const router = useRouter();
  const csrfProof = useCsrfProof();
  const [form, setForm] = useState(() => toFormState(initialPreferences));
  const [tagInputs, setTagInputs] = useState<Record<TagField, string>>({
    customPositions: "",
    skills: "",
    workLocations: "",
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  function addTag(field: TagField, maximum: number) {
    const value = tagInputs[field].trim();
    if (!value) return;
    const values = form[field];
    if (
      values.some(
        (item) => item.toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    ) {
      setTagInputs((current) => ({ ...current, [field]: "" }));
      return;
    }
    if (values.length >= maximum) {
      setError(
        field === "customPositions"
          ? "Bạn chỉ có thể thêm tối đa 5 vị trí tự nhập."
          : field === "skills"
            ? "Bạn chỉ có thể thêm tối đa 20 kỹ năng."
            : "Bạn chỉ có thể chọn tối đa 63 tỉnh/thành phố.",
      );
      return;
    }
    setForm((current) => ({
      ...current,
      [field]: [...current[field], value],
    }));
    setTagInputs((current) => ({ ...current, [field]: "" }));
    setError("");
  }

  function removeTag(field: TagField, value: string) {
    setForm((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value),
    }));
  }

  function handleTagKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    field: TagField,
    maximum: number,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTag(field, maximum);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!form.aiAnalysisConsent) {
      setError(
        "Bạn cần đồng ý cho phép SmartHire phân tích để nhận gợi ý việc làm.",
      );
      return;
    }
    const parsed = jobPreferencesSchema.safeParse({
      ...form,
      desiredSalaryMin:
        Number(form.desiredSalaryMin.replace(/[^\d]/gu, "")) || 0,
    });
    if (!parsed.success) {
      setError("Vui lòng kiểm tra lại các thông tin đã nhập.");
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
            : "Không thể cập nhật tùy chọn việc làm.",
        );
      }
      setStatus("Đã cập nhật tùy chọn việc làm.");
      router.push("/jobs/matches");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể cập nhật tùy chọn việc làm.",
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
          <p>Chia sẻ nhu cầu để nhận các cơ hội phù hợp hơn với bạn.</p>
        </div>
      </div>
      <p className="job-preferences-required">
        <span>*</span> Các thông tin bắt buộc
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
        <legend>Thông tin cá nhân</legend>
        <div className="preference-field">
          <span className="preference-label">Giới tính</span>
          <div className="preference-radio-group">
            {[
              ["female", "Nữ"],
              ["male", "Nam"],
              ["undisclosed", "Không xác định"],
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
        <legend>Nhu cầu việc làm</legend>
        <div className="preference-field">
          <label className="preference-label" htmlFor="professional-positions">
            Vị trí chuyên môn <span>*</span>
          </label>
          <select
            id="professional-positions"
            className="preference-select preference-select--multiple"
            multiple
            value={form.professionalPositions}
            onChange={(event) => {
              const values = Array.from(
                event.currentTarget.selectedOptions,
                (option) => option.value,
              );
              setForm((current) => ({
                ...current,
                professionalPositions: values.slice(0, 5),
              }));
            }}
          >
            {positionOptions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.label} · {position.family}
              </option>
            ))}
          </select>
          <small>Giữ Ctrl/Cmd để chọn tối đa 5 vị trí.</small>
        </div>

        <div className="preference-field">
          <label className="preference-label" htmlFor="custom-position">
            Vị trí khác
          </label>
          <div className="preference-tag-input">
            <input
              id="custom-position"
              value={tagInputs.customPositions}
              placeholder="Nhập vị trí chưa có trong danh sách"
              onChange={(event) =>
                setTagInputs((current) => ({
                  ...current,
                  customPositions: event.target.value,
                }))
              }
              onKeyDown={(event) =>
                handleTagKeyDown(event, "customPositions", 5)
              }
            />
            <button type="button" onClick={() => addTag("customPositions", 5)}>
              Thêm
            </button>
          </div>
          <TagList
            values={form.customPositions}
            onRemove={(value) => removeTag("customPositions", value)}
          />
        </div>

        <div className="preference-field">
          <label className="preference-label" htmlFor="skills-input">
            Kỹ năng <span>*</span>
          </label>
          <div className="preference-tag-input">
            <input
              id="skills-input"
              list="skills-options"
              value={tagInputs.skills}
              placeholder="Thêm kỹ năng"
              onChange={(event) =>
                setTagInputs((current) => ({
                  ...current,
                  skills: event.target.value,
                }))
              }
              onKeyDown={(event) => handleTagKeyDown(event, "skills", 20)}
            />
            <datalist id="skills-options">
              {skillOptions.map((skill) => (
                <option key={skill} value={skill} />
              ))}
            </datalist>
            <button type="button" onClick={() => addTag("skills", 20)}>
              Thêm
            </button>
          </div>
          <TagList
            values={form.skills}
            onRemove={(value) => removeTag("skills", value)}
          />
        </div>

        <div className="preference-field">
          <label className="preference-label" htmlFor="experience-level">
            Kinh nghiệm <span>*</span>
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
            Mức lương mong muốn <span>*</span>
          </label>
          <div className="preference-input-suffix">
            <input
              id="desired-salary"
              inputMode="numeric"
              value={formatSalaryInput(form.desiredSalaryMin)}
              placeholder="15.000.000"
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
          <label className="preference-label" htmlFor="location-input">
            Tỉnh/Thành phố cũ (trước 1/7/2025) <span>*</span>
          </label>
          <div className="preference-tag-input">
            <input
              id="location-input"
              list="province-options"
              value={tagInputs.workLocations}
              placeholder="Chọn tỉnh/thành phố"
              onChange={(event) =>
                setTagInputs((current) => ({
                  ...current,
                  workLocations: event.target.value,
                }))
              }
              onKeyDown={(event) =>
                handleTagKeyDown(event, "workLocations", 63)
              }
            />
            <datalist id="province-options">
              {VIETNAM_PROVINCES_63.map((province) => (
                <option key={province} value={province} />
              ))}
            </datalist>
            <button type="button" onClick={() => addTag("workLocations", 63)}>
              Thêm
            </button>
          </div>
          <TagList
            values={form.workLocations}
            onRemove={(value) => removeTag("workLocations", value)}
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
          Tôi có thể thay đổi địa điểm làm việc
        </label>
      </fieldset>

      <fieldset>
        <legend>Đồng ý nhận thông tin</legend>
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
          Tôi đồng ý để SmartHire gợi ý việc làm dựa trên CV và hoạt động tìm
          việc, quá trình phân tích có thể sử dụng công nghệ AI. <span>*</span>
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
          Tôi đồng ý cho phép SmartHire gửi thông tin liên quan đến việc làm, sự
          kiện nghề nghiệp.
        </label>
      </fieldset>

      <div className="job-preferences-actions">
        <button className="dashboard-hero-cta" type="submit" disabled={pending}>
          {pending ? "Đang cập nhật..." : "Cập nhật"}
        </button>
      </div>
    </form>
  );
}

function TagList({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (value: string) => void;
}) {
  if (!values.length) return null;
  return (
    <ul className="preference-tag-list">
      {values.map((value) => (
        <li key={value}>
          <span>{value}</span>
          <button
            type="button"
            aria-label={"Xóa " + value}
            onClick={() => onRemove(value)}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
