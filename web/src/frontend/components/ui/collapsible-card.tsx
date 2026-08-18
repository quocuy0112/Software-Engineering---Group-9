"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

export type CollapsibleCardProps = {
  title: ReactNode;
  children: ReactNode;
  /** Content that stays visible while the card details are collapsed. */
  persistentContent?: ReactNode;
  defaultExpanded?: boolean;
  eyebrow?: ReactNode;
  className?: string;
  id?: string;
  triggerClassName?: string;
  contentClassName?: string;
  titleId?: string;
  contentId?: string;
};

export function CollapsibleCard({
  title,
  children,
  persistentContent,
  defaultExpanded = true,
  eyebrow,
  className = "",
  id,
  triggerClassName = "",
  contentClassName = "",
  titleId,
  contentId,
}: CollapsibleCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const generatedId = useId().replace(/:/gu, "");
  const resolvedTitleId = titleId ?? `collapsible-card-title-${generatedId}`;
  const resolvedContentId =
    contentId ?? `collapsible-card-content-${generatedId}`;

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setExpanded((current) => !current);
  }

  return (
    <section
      id={id}
      className={["sh-collapsible-card", className].filter(Boolean).join(" ")}
      data-expanded={expanded ? "true" : "false"}
      aria-labelledby={resolvedTitleId}
    >
      <button
        className={["sh-collapsible-card__trigger", triggerClassName]
          .filter(Boolean)
          .join(" ")}
        type="button"
        aria-controls={resolvedContentId}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="sh-collapsible-card__title" id={resolvedTitleId}>
          {eyebrow ? (
            <span className="sh-collapsible-card__eyebrow">{eyebrow}</span>
          ) : null}
          {title}
        </span>
        <span className="sh-collapsible-card__chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {persistentContent ? (
        <div className="sh-collapsible-card__persistent">
          {persistentContent}
        </div>
      ) : null}
      <div
        className={["sh-collapsible-card__content", contentClassName]
          .filter(Boolean)
          .join(" ")}
        id={resolvedContentId}
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
      >
        <div className="sh-collapsible-card__content-inner">{children}</div>
      </div>
    </section>
  );
}
