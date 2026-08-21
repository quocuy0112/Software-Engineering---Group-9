import { Bookmark, FileText, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

/** Read-only profile data is intentionally locked only for this application. */
export function LockedField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: ReactNode;
}) {
  return (
    <div className="application-personal-information__field">
      <div className="application-personal-information__field-label">
        <span>{label}</span>
      </div>
      <div
        className="application-personal-information__locked-box"
        role="textbox"
        aria-readonly="true"
        aria-label={`${label}: ${value}`}
      >
        <span>{value}</span>
        <LockKeyhole aria-hidden="true" />
      </div>
      {helper ? (
        <p className="application-personal-information__locked-note">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function RequirementTag({
  level,
  children,
}: {
  level: "required" | "optional";
  children: ReactNode;
}) {
  return (
    <span
      className={`application-files__pill${level === "required" ? " application-files__pill--required" : ""}`}
    >
      {children}
    </span>
  );
}

export function FileSelectionCard({
  fileName,
  meta,
  selected,
  disabled,
  onSelect,
}: {
  fileName: string;
  meta: ReactNode;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={selected ? "is-selected" : undefined}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="application-files__radio" aria-hidden="true" />
      <span>
        <strong>{fileName}</strong>
        <small>{meta}</small>
      </span>
    </button>
  );
}

export function ReviewSummaryCard({
  title,
  edit,
  children,
}: {
  title: string;
  edit: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="application-review-submit__card">
      <div className="application-review-submit__card-heading">
        <h2>{title}</h2>
        {edit}
      </div>
      {children}
    </section>
  );
}

export function ApplicationFileIcon() {
  return (
    <span className="application-review-submit__file-icon">
      <FileText aria-hidden="true" />
    </span>
  );
}

/** Shared page header keeps all three persisted Apply steps visually identical. */
export function ApplicationFlowHeader({
  titleId,
  eyebrow,
  title,
  subtitle,
  saveLabel,
  savingLabel,
  pending,
  onSave,
}: {
  titleId: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  saveLabel: string;
  savingLabel: string;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <header className="application-flow-header">
      <div>
        <p className="application-flow-header__eyebrow">
          <span aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 id={titleId}>{title}</h1>
        <p className="application-flow-header__subtitle">{subtitle}</p>
      </div>
      <button
        type="button"
        className="application-flow-header__save"
        onClick={onSave}
        disabled={pending}
      >
        <Bookmark aria-hidden="true" />
        {pending ? savingLabel : saveLabel}
      </button>
    </header>
  );
}
