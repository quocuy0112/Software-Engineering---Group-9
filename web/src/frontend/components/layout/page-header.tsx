import type { ReactNode } from "react";
import { StatusPill, type StatusPillTone } from "../ui/design-system";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  status,
  rightSlot,
  titleId,
  className = "",
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: {
    label: string;
    tone?: StatusPillTone;
    pulsing?: boolean;
    state?: string;
    announce?: boolean;
  };
  rightSlot?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={["sh-page-header", className].filter(Boolean).join(" ")}>
      <div className="sh-page-header__copy">
        <p className="sh-page-header__eyebrow">
          <span aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 id={titleId}>{title}</h1>
        {subtitle ? (
          <p className="sh-page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {rightSlot ??
        (status ? (
          <StatusPill
            label={status.label}
            tone={status.tone}
            pulsing={status.pulsing}
            state={status.state}
            role={status.announce ? "status" : undefined}
            className={
              className.includes("workspace-page-header")
                ? "workspace-page-header__status"
                : ""
            }
          />
        ) : null)}
    </header>
  );
}
