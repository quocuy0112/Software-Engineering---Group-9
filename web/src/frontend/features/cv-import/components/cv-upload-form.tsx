"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import type { CvParserClass } from "@/shared/contracts/cv-import/common";
import { CV_SOURCE_MAX_BYTES } from "@/shared/contracts/cv-import/common";
import { CvProcessingNotice } from "./cv-processing-notice";
import styles from "./cv-upload-form.module.css";

const accepted = new Map([
  ["application/pdf", ".pdf"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
]);

const subscribeToHydration = () => () => undefined;

export function CvUploadForm({
  csrfProof,
  onUpload,
}: {
  csrfProof: string;
  onUpload(
    file: File,
    parserClass: CvParserClass,
    csrfProof: string,
  ): Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parserClass, setParserClass] = useState<CvParserClass>(
    "DETERMINISTIC_INTERNAL",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Ready to upload a CV.");
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

  const showError = (value: string, focusFile = false) => {
    focusFileAfterError.current = focusFile;
    setError(value);
  };

  const choose = (candidate: File | null) => {
    setError(null);
    if (!candidate) return setFile(null);
    const extension = accepted.get(candidate.type);
    if (!extension || !candidate.name.toLowerCase().endsWith(extension)) {
      setFile(null);
      return showError(
        "Choose a PDF or DOCX file whose extension matches its type.",
        true,
      );
    }
    if (candidate.size < 1 || candidate.size > CV_SOURCE_MAX_BYTES) {
      setFile(null);
      return showError(
        "The CV must be no larger than 5 MB (5,000,000 bytes).",
        true,
      );
    }
    setFile(candidate);
    setMessage(`${candidate.name} is ready to upload.`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return showError("Choose a PDF or DOCX CV before uploading.");
    setBusy(true);
    setError(null);
    setMessage("Uploading CV…");
    try {
      await onUpload(file, parserClass, csrfProof);
      setMessage("CV upload submitted for secure processing.");
    } catch {
      showError(
        "The CV upload failed. Try again or enter your profile manually.",
      );
      setMessage("Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      data-testid="cv-upload-form"
      data-narrow-layout="320"
      data-reduced-motion-safe="true"
      noValidate
    >
      <CvProcessingNotice parserClass={parserClass} />
      {error ? (
        <div className={styles.error} role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </div>
      ) : null}
      <div className={styles.field}>
        <label htmlFor="cv-upload-file">CV file</label>
        <input
          id="cv-upload-file"
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => choose(event.currentTarget.files?.[0] ?? null)}
          disabled={busy || !hydrated}
        />
        <small id="cv-upload-guidance">
          PDF or DOCX, maximum 5 MB (5,000,000 bytes).
        </small>
      </div>
      <div className={styles.field}>
        <label htmlFor="cv-upload-parser">Parser</label>
        <select
          id="cv-upload-parser"
          value={parserClass}
          onChange={(event) =>
            setParserClass(event.currentTarget.value as CvParserClass)
          }
          disabled={busy || !hydrated}
        >
          <option value="DETERMINISTIC_INTERNAL">
            SmartHire deterministic parser
          </option>
          <option value="EXTERNAL_OPENAI">Approved external parser</option>
        </select>
      </div>
      <div className={styles.actions}>
        <button type="submit" disabled={!hydrated || busy}>
          {busy ? "Uploading…" : "Upload CV"}
        </button>
        <a href="/profile">Enter profile manually</a>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
