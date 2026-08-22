"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "@/frontend/components/ui/button";
import { SelectableCard } from "@/frontend/components/ui/cv-import-primitives";
import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import { CV_SOURCE_MAX_BYTES } from "@/shared/contracts/cv-import/common";
import { validateCvFile } from "@/shared/cv-file-validation";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";
import { cvCopy } from "../i18n/cv-import-copy";
import { CvProcessingNotice } from "./cv-processing-notice";
import styles from "./cv-upload-form.module.css";

const acceptedExtensions = new Set(["pdf", "doc", "docx"]);

const subscribeToHydration = () => () => undefined;

export function CvUploadForm({
  csrfProof,
  onUpload,
  parserAvailability = { deterministic: true, external: true },
}: {
  csrfProof: string;
  parserAvailability?: Readonly<{ deterministic: boolean; external: boolean }>;
  onUpload(
    file: File,
    parserClass: CvParserClass,
    csrfProof: string,
  ): Promise<void>;
}) {
  const locale = useWorkspaceLocale();
  const copy = cvCopy(locale);
  const [file, setFile] = useState<File | null>(null);
  const [parserClass, setParserClass] = useState<CvParserClass | null>(
    parserAvailability.deterministic
      ? "DETERMINISTIC_INTERNAL"
      : parserAvailability.external
        ? "EXTERNAL_OPENAI"
        : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(copy.upload.ready);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const focusFileAfterError = useRef(false);

  useEffect(() => {
    if (!error) return;
    if (focusFileAfterError.current) fileRef.current?.focus();
    else errorRef.current?.focus();
  }, [error]);

  function showError(value: string, focusFile = false) {
    focusFileAfterError.current = focusFile;
    setError(value);
    toast.error(value, { id: "candidate-cv-upload-error" });
  }

  function clearSelection() {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function choose(candidate: File | null) {
    setError(null);
    if (!candidate) {
      clearSelection();
      setMessage(copy.upload.ready);
      return;
    }
    const extension = candidate.name.toLowerCase().split(".").pop();
    if (!extension || !acceptedExtensions.has(extension)) {
      clearSelection();
      setMessage(copy.upload.ready);
      return showError(
        locale === "vi"
          ? "Hãy chọn tệp PDF hoặc DOCX có phần mở rộng phù hợp."
          : "Only PDF, DOC, or DOCX files are supported.",
        true,
      );
    }
    if (candidate.size < 1 || candidate.size > CV_SOURCE_MAX_BYTES) {
      clearSelection();
      setMessage(copy.upload.ready);
      return showError(
        locale === "vi"
          ? "CV không được lớn hơn 5 MB (5.000.000 byte)."
          : candidate.size > CV_SOURCE_MAX_BYTES
            ? "File size must not exceed 5MB."
            : "The uploaded file is empty.",
        true,
      );
    }
    try {
      await validateCvFile(candidate);
    } catch (cause) {
      clearSelection();
      setMessage(copy.upload.ready);
      return showError(
        cause instanceof Error
          ? cause.message
          : locale === "vi"
            ? "Chỉ hỗ trợ tệp PDF hoặc DOCX hợp lệ."
            : "Only valid PDF, DOC, or DOCX files are supported.",
        true,
      );
    }
    setFile(candidate);
    setMessage(
      locale === "vi"
        ? `${candidate.name} sẵn sàng để tải lên.`
        : `${candidate.name} is ready to upload.`,
    );
  }

  function selectParser(nextParser: CvParserClass) {
    setParserClass(nextParser);
    setMessage(
      nextParser === "EXTERNAL_OPENAI"
        ? locale === "vi"
          ? "Đã chọn OpenAI. Bạn sẽ cấp quyền sau khi trích xuất văn bản an toàn."
          : "OpenAI selected. You will grant consent after secure text extraction."
        : locale === "vi"
          ? "Đã chọn bộ phân tích SmartHire cho CV này."
          : "SmartHire parser selected for this CV.",
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file)
      return showError(
        locale === "vi"
          ? "Hãy chọn CV PDF hoặc DOCX trước khi tải lên."
          : "Choose a PDF, DOC, or DOCX CV before uploading.",
      );
    if (!parserClass)
      return showError(
        locale === "vi"
          ? "Hiện không có bộ phân tích CV khả dụng."
          : "No CV parser is currently available.",
      );

    setBusy(true);
    setError(null);
    setMessage(locale === "vi" ? "Đang tải CV…" : "Uploading CV…");
    try {
      await onUpload(file, parserClass, csrfProof);
      setMessage(
        locale === "vi"
          ? "Đã gửi CV để xử lý an toàn."
          : "CV upload submitted for secure processing.",
      );
    } catch (cause) {
      clearSelection();
      showError(
        cause instanceof Error && !cause.message.startsWith("CV_")
          ? cause.message
          : cause instanceof Error && cause.message.includes("not available")
            ? locale === "vi"
              ? "Bộ phân tích đã chọn hiện không khả dụng. Hãy kiểm tra cấu hình rồi thử lại."
              : cause.message
            : locale === "vi"
              ? "Tải CV không thành công. Hãy thử lại hoặc nhập hồ sơ thủ công."
              : "The CV upload failed. Try again or enter your profile manually.",
      );
      setMessage(
        locale === "vi" ? "Tải lên không thành công." : "Upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      data-testid="cv-upload-form"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      noValidate
    >
      {parserClass ? <CvProcessingNotice parserClass={parserClass} /> : null}
      {error ? (
        <div className={styles.error} role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="cv-upload-file">{copy.upload.file}</label>
        <input
          id="cv-upload-file"
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) =>
            void choose(event.currentTarget.files?.[0] ?? null)
          }
          disabled={busy || !hydrated}
        />
        <small id="cv-upload-guidance">{copy.upload.fileGuidance}</small>
      </div>
      <fieldset className={styles.parserFieldset}>
        <legend>{copy.upload.chooseParser}</legend>
        <p className={styles.parserGuidance}>{copy.upload.parserGuidance}</p>
        <div className={styles.parserOptions}>
          <SelectableCard
            avatarLabel="SH"
            title={copy.upload.deterministic}
            description={copy.upload.deterministicHint}
            statusLabel={
              parserAvailability.deterministic
                ? copy.upload.local
                : copy.upload.unavailable
            }
            selected={parserClass === "DETERMINISTIC_INTERNAL"}
            inputProps={{
              type: "radio",
              name: "cv-upload-parser",
              value: "DETERMINISTIC_INTERNAL",
              checked: parserClass === "DETERMINISTIC_INTERNAL",
              onChange: () => selectParser("DETERMINISTIC_INTERNAL"),
              disabled: busy || !hydrated || !parserAvailability.deterministic,
            }}
          />
          <SelectableCard
            avatarLabel="AI"
            title={copy.upload.external}
            description={copy.upload.externalHint}
            statusLabel={
              parserAvailability.external
                ? copy.upload.aiReady
                : copy.upload.notConfigured
            }
            selected={parserClass === "EXTERNAL_OPENAI"}
            inputProps={{
              type: "radio",
              name: "cv-upload-parser",
              value: "EXTERNAL_OPENAI",
              checked: parserClass === "EXTERNAL_OPENAI",
              onChange: () => selectParser("EXTERNAL_OPENAI"),
              disabled: busy || !hydrated || !parserAvailability.external,
            }}
          />
        </div>
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" disabled={!hydrated || busy || !parserClass}>
          {busy ? copy.upload.uploading : copy.upload.upload}
        </Button>
        <a href="/profile">{copy.upload.manual}</a>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
