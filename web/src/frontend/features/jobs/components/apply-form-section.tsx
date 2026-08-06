"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useCsrfProof } from "@/frontend/features/authentication/client/csrf-proof-context";
import { mutateWithCurrentCsrf } from "@/frontend/features/authentication/client/current-csrf-proof";
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
const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
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
  return value.replace(/[\s().-]/gu, "");
}

function fileRef(file: File) {
  const name = file.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .slice(0, 64);
  return "cv-upload-" + name + "-" + file.size + "-" + file.lastModified;
}

function validateContact(contact: ApplicationContactSnapshot): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.fullName.trim()) errors.fullName = "Vui lòng nhập họ và tên.";
  if (!contact.email.trim()) {
    errors.email = "Vui lòng nhập email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(contact.email.trim())) {
    errors.email = "Email chưa đúng định dạng.";
  }
  const phone = normalizePhone(contact.phone);
  if (!phone) {
    errors.phone = "Vui lòng nhập số điện thoại.";
  } else if (!/^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/u.test(phone)) {
    errors.phone = "Số điện thoại phải là số điện thoại Việt Nam hợp lệ.";
  }
  return errors;
}

function fieldA11y(field: string, errors: FieldErrors) {
  return {
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? field + "-error" : undefined,
  };
}

function InlineApplicationForm({
  form,
  onCancel,
  onSubmitted,
}: {
  form: ApplicationForm;
  onCancel: () => void;
  onSubmitted: (outcome: ApplicationOutcome, meta: ApplicationMeta) => void;
}) {
  const csrfProof = useCsrfProof();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [selectedCvId, setSelectedCvId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [contact, setContact] = useState<ApplicationContactSnapshot>(
    form.contact ?? { fullName: "", email: "", phone: "" },
  );
  const [aiConsent, setAiConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const accepted =
      ACCEPTED_CV_TYPES.has(file.type) ||
      extension === "pdf" ||
      extension === "doc" ||
      extension === "docx";
    if (!accepted) {
      setSelectedFile(null);
      setErrors((current) => ({
        ...current,
        cv: "CV chỉ nhận định dạng PDF, DOC hoặc DOCX.",
      }));
      return;
    }
    if (file.size < 1 || file.size > MAX_CV_BYTES) {
      setSelectedFile(null);
      setErrors((current) => ({
        ...current,
        cv: "Dung lượng CV phải từ 1 đến 5MB.",
      }));
      return;
    }
    setSelectedFile(file);
    setSelectedCvId("");
    setErrors((current) => {
      const next = { ...current };
      delete next.cv;
      return next;
    });
  }

  function validate(): boolean {
    const next = validateContact({
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: normalizePhone(contact.phone),
    });
    if (!selectedCvId && !selectedFile)
      next.cv = "Vui lòng chọn CV đã lưu hoặc tải CV lên.";
    setErrors(next);
    return Object.keys(next).length === 0;
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
    const cvFileRef = selectedFile ? fileRef(selectedFile) : selectedCvId;
    const contactSnapshot = {
      fullName: contact.fullName.trim(),
      email: contact.email.trim(),
      phone: normalizePhone(contact.phone),
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
        // Kept for the existing employer-facing application contract. The
        // AI analysis choice below is intentionally independent and optional.
        consentAccepted: true as const,
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
            : "Không thể gửi hồ sơ ứng tuyển.",
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
      setError("Không thể gửi hồ sơ ứng tuyển. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  const contactValid = Object.keys(validateContact(contact)).length === 0;
  const submitDisabled =
    pending || !contactValid || (!selectedCvId && !selectedFile);

  return (
    <form
      className="job-form-grid"
      aria-label={
        "Apply for " + form.jobTitle + " / Ứng tuyển cho " + form.jobTitle
      }
      onSubmit={submit}
      onChange={() => {
        idempotencyKey.current = null;
        setError(null);
      }}
      noValidate
    >
      {!form.profileReady ? (
        <div role="alert">
          Hoàn thiện các trường hồ sơ trước:{" "}
          {form.missingProfileFields.join(", ")}.
        </div>
      ) : null}

      <fieldset className="job-application-fieldset">
        <legend>CV ứng tuyển</legend>
        <p className="job-form-help">
          Chọn CV đã lưu trên SmartHire hoặc tải CV mới (PDF, DOC, DOCX; tối đa
          5MB).
        </p>
        {form.cvs.length ? (
          <label htmlFor="application-cv-id">
            Dùng CV đã lưu trên SmartHire / Select CV
            <select
              id="application-cv-id"
              name="cvId"
              value={selectedCvId}
              disabled={pending}
              {...fieldA11y("cv", errors)}
              onChange={(event) => {
                setSelectedCvId(event.currentTarget.value);
                setSelectedFile(null);
                setErrors((current) => {
                  const next = { ...current };
                  delete next.cv;
                  return next;
                });
              }}
            >
              <option value="">Chọn CV đã lưu</option>
              {form.cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.displayName} · {cv.fileName} ({formatBytes(cv.byteSize)})
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
            {selectedFile
              ? "CV mới đã chọn"
              : "Kéo-thả CV vào đây hoặc click để chọn"}
          </span>
          <span className="job-form-help">PDF, DOC, DOCX · tối đa 5MB</span>
          <input
            ref={fileInputRef}
            id="application-cv-upload"
            name="cvUpload"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-describedby={errors.cv ? "cv-error" : undefined}
            disabled={pending}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {selectedFile ? (
          <div className="job-selected-file" role="status">
            <span>
              <strong>{selectedFile.name}</strong> ·{" "}
              {formatBytes(selectedFile.size)}
            </span>
            <span className="job-file-actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={pending}
              >
                Đổi file
              </button>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={pending}
              >
                Xoá
              </button>
            </span>
          </div>
        ) : null}
        {errors.cv ? (
          <p id="cv-error" className="job-field-error" role="alert">
            {errors.cv}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="job-application-fieldset">
        <legend>Thông tin liên hệ</legend>
        <label htmlFor="application-full-name">
          Họ và tên <span aria-hidden="true">*</span>
          <input
            id="application-full-name"
            name="fullName"
            autoComplete="name"
            value={contact.fullName}
            {...fieldA11y("fullName", errors)}
            onChange={(event) =>
              setContact((current) => ({
                ...current,
                fullName: event.currentTarget.value,
              }))
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
              setContact((current) => ({
                ...current,
                email: event.currentTarget.value,
              }))
            }
          />
          {errors.email ? (
            <span id="email-error" className="job-field-error" role="alert">
              {errors.email}
            </span>
          ) : null}
        </label>
        <label htmlFor="application-phone">
          Số điện thoại <span aria-hidden="true">*</span>
          <input
            id="application-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={contact.phone}
            {...fieldA11y("phone", errors)}
            onChange={(event) =>
              setContact((current) => ({
                ...current,
                phone: event.currentTarget.value,
              }))
            }
          />
          {errors.phone ? (
            <span id="phone-error" className="job-field-error" role="alert">
              {errors.phone}
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
        <label className="job-checkbox-label" htmlFor="application-ai-consent">
          <input
            id="application-ai-consent"
            name="aiAnalysisConsent"
            type="checkbox"
            aria-label="I consent to AI CV analysis / Tôi đồng ý để SmartHire sử dụng AI phân tích CV"
            checked={aiConsent}
            onChange={(event) => setAiConsent(event.currentTarget.checked)}
          />
          <span>
            Tôi đồng ý để SmartHire sử dụng công nghệ AI để phân tích mức độ phù
            hợp giữa CV của tôi và vị trí ứng tuyển này.{" "}
            <Link href="/legal/ai-cv-analysis-policy" target="_blank">
              Tìm hiểu thêm
            </Link>
          </span>
        </label>
        <p className="job-form-help">
          Không bắt buộc. Nếu không chọn, CV vẫn được gửi tới nhà tuyển dụng
          bình thường và không được AI chấm điểm.
        </p>
      </div>

      {error ? (
        <div role="alert" className="job-feedback">
          {error}
        </div>
      ) : null}
      <div className="job-actions">
        <button type="submit" disabled={submitDisabled}>
          {pending ? "Đang gửi…" : "Gửi hồ sơ ứng tuyển / Submit application"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          Huỷ / Cancel
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
              : "Không thể tải form ứng tuyển.",
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
              : "Không thể tải form ứng tuyển.",
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

  return (
    <section
      id="apply"
      className={"job-apply-section" + (open ? " is-open" : "")}
      aria-labelledby="job-apply-heading"
      aria-hidden={!open}
    >
      <div className="job-apply-section-inner">
        <div className="job-apply-section-heading">
          <div>
            <p className="panel-kicker">APPLY INLINE</p>
            <h2 id="job-apply-heading">Form ứng tuyển</h2>
            <p>Ứng tuyển vào {jobTitle} trên SmartHire.</p>
          </div>
          <button
            type="button"
            className="job-icon-button"
            aria-label="Close application form / Đóng form ứng tuyển"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>
        {open && !form && !outcome && !applied && !loadError ? (
          <p className="job-feedback job-feedback-info" role="status">
            Đang chuẩn bị form ứng tuyển…
          </p>
        ) : loadError ? (
          <div className="job-feedback" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => setLoadError(null)}>
              Thử lại
            </button>
          </div>
        ) : outcome ? (
          <div className="job-application-confirmation" role="status">
            <strong>
              Đã ứng tuyển thành công vào {form?.jobTitle ?? jobTitle}.
            </strong>
            <p>Nhà tuyển dụng sẽ liên hệ nếu phù hợp.</p>
            {outcome.aiAnalysisConsent ? (
              <p>
                Độ phù hợp: <strong>{outcome.aiMatchScore ?? 82}%</strong> — dựa
                trên các kỹ năng và kinh nghiệm liên quan đến vị trí này.
              </p>
            ) : null}
          </div>
        ) : applied ? (
          <div className="job-application-confirmation" role="status">
            Bạn đã ứng tuyển vào vị trí này.
          </div>
        ) : form ? (
          <InlineApplicationForm
            form={form}
            onCancel={() => onOpenChange(false)}
            onSubmitted={handleSubmitted}
          />
        ) : null}
      </div>
    </section>
  );
}
