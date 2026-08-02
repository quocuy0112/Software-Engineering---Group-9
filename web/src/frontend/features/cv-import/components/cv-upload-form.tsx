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
  parserAvailability = { deterministic: true, external: true },
}: {
  csrfProof: string;
  parserAvailability?: Readonly<{
    deterministic: boolean;
    external: boolean;
  }>;
  onUpload(
    file: File,
    parserClass: CvParserClass,
    csrfProof: string,
  ): Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parserClass, setParserClass] = useState<CvParserClass | null>(
    parserAvailability.deterministic
      ? "DETERMINISTIC_INTERNAL"
      : parserAvailability.external
        ? "EXTERNAL_OPENAI"
        : null,
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
    if (!parserClass) return showError("No CV parser is currently available.");
    setBusy(true);
    setError(null);
    setMessage("Uploading CV…");
    try {
      await onUpload(file, parserClass, csrfProof);
      setMessage("CV upload submitted for secure processing.");
    } catch (cause) {
      showError(
        cause instanceof Error && cause.message.includes("not available")
          ? cause.message
          : "The CV upload failed. Try again or enter your profile manually.",
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
      {parserClass ? <CvProcessingNotice parserClass={parserClass} /> : null}
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
      <fieldset className={styles.parserFieldset}>
        <legend>Choose a parser for this upload</legend>
        <p className={styles.parserGuidance}>
          Each CV can use a different parser. Your choice is saved with this
          import.
        </p>
        <div className={styles.parserOptions}>
          <label
            className={styles.parserOption}
            data-selected={parserClass === "DETERMINISTIC_INTERNAL"}
            data-disabled={!parserAvailability.deterministic}
          >
            <input
              type="radio"
              name="cv-upload-parser"
              value="DETERMINISTIC_INTERNAL"
              checked={parserClass === "DETERMINISTIC_INTERNAL"}
              onChange={() => {
                setParserClass("DETERMINISTIC_INTERNAL");
                setMessage("SmartHire parser selected for this CV.");
              }}
              disabled={busy || !hydrated || !parserAvailability.deterministic}
            />
            <span className={styles.parserMark} aria-hidden="true">
              SH
            </span>
            <span className={styles.parserCopy}>
              <strong>SmartHire deterministic</strong>
              <small>
                Runs locally without sending text to an AI provider.
              </small>
            </span>
            <span className={styles.parserBadge}>
              {parserAvailability.deterministic ? "Local" : "Unavailable"}
            </span>
          </label>
          <label
            className={styles.parserOption}
            data-selected={parserClass === "EXTERNAL_OPENAI"}
            data-disabled={!parserAvailability.external}
          >
            <input
              type="radio"
              name="cv-upload-parser"
              value="EXTERNAL_OPENAI"
              checked={parserClass === "EXTERNAL_OPENAI"}
              onChange={() => {
                setParserClass("EXTERNAL_OPENAI");
                setMessage(
                  "OpenAI selected. You will grant consent after secure text extraction.",
                );
              }}
              disabled={busy || !hydrated || !parserAvailability.external}
            />
            <span className={styles.parserMark} aria-hidden="true">
              AI
            </span>
            <span className={styles.parserCopy}>
              <strong>External OpenAI</strong>
              <small>
                AI-assisted parsing after scanning, extraction, and consent.
              </small>
            </span>
            <span className={styles.parserBadge}>
              {parserAvailability.external ? "AI ready" : "Not configured"}
            </span>
          </label>
        </div>
      </fieldset>
      <div className={styles.actions}>
        <button type="submit" disabled={!hydrated || busy || !parserClass}>
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
