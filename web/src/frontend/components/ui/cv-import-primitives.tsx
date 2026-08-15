import type { ComponentPropsWithoutRef, InputHTMLAttributes, ReactNode } from "react";

import { Badge } from "./badge";

export function StatCard({
  value,
  label,
  sublabel,
}: {
  value: ReactNode;
  label: ReactNode;
  sublabel: ReactNode;
}) {
  return (
    <div className="sh-stat-card">
      <strong className="sh-stat-card__value">{value}</strong>
      <span className="sh-stat-card__label">{label}</span>
      <small className="sh-stat-card__sublabel">{sublabel}</small>
    </div>
  );
}

export function StepCard({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: ReactNode;
  subtitle: ReactNode;
}) {
  return (
    <article className="sh-step-card">
      <span className="sh-step-card__number" aria-hidden="true">
        {number}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </article>
  );
}

export function InfoBanner({
  icon,
  title,
  description,
  tone = "info",
  className = "",
  ...props
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  tone?: "info" | "warning";
  className?: string;
} & Omit<ComponentPropsWithoutRef<"aside">, "title">) {
  return (
    <aside
      className={["sh-info-banner", className].filter(Boolean).join(" ")}
      data-tone={tone}
      role="note"
      {...props}
    >
      <Badge icon={icon} tone={tone === "warning" ? "amber" : "blue"} />
      <div className="sh-info-banner__copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </aside>
  );
}

export function SelectableCard({
  avatarLabel,
  title,
  description,
  statusLabel,
  selected,
  inputProps,
  className = "",
}: {
  avatarLabel: ReactNode;
  title: ReactNode;
  description: ReactNode;
  statusLabel: ReactNode;
  selected: boolean;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  className?: string;
}) {
  return (
    <label
      className={["sh-selectable-card", className].filter(Boolean).join(" ")}
      data-selected={selected}
      data-disabled={inputProps.disabled ? "true" : undefined}
    >
      <input {...inputProps} />
      <span className="sh-selectable-card__avatar" aria-hidden="true">
        {avatarLabel}
      </span>
      <span className="sh-selectable-card__copy">
        <span className="sh-selectable-card__title">{title}</span>
        <small>{description}</small>
      </span>
      <span className="sh-selectable-card__status">{statusLabel}</span>
    </label>
  );
}

export function StatusStrip({
  title,
  description,
  progressPercent,
  action,
  state,
}: {
  title: ReactNode;
  description: ReactNode;
  progressPercent?: number;
  action?: ReactNode;
  state?: string;
}) {
  const value = Math.max(0, Math.min(100, progressPercent ?? 0));
  return (
    <section className="sh-status-strip" data-state={state}>
      <span className="sh-status-strip__dot" aria-hidden="true" />
      <div className="sh-status-strip__copy" role="status" aria-live="polite">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div
        className="sh-status-strip__track"
        role="progressbar"
        aria-label="CV import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      {action ? <div className="sh-status-strip__action">{action}</div> : null}
    </section>
  );
}
