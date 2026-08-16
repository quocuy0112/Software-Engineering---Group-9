import { type KeyboardEvent, type ReactNode, useId } from "react";

export type ContentTab = {
  id?: string;
  label: ReactNode;
};

export type ContentTabsProps = {
  tabs: readonly ContentTab[];
  activeIndex: number;
  onChange: (index: number) => void;
  ariaLabel?: string;
  tabIdPrefix?: string;
  panelId?: string;
  className?: string;
};

export function ContentTabs({
  tabs,
  activeIndex,
  onChange,
  ariaLabel = "Content sections",
  tabIdPrefix,
  panelId,
  className = "",
}: ContentTabsProps) {
  const generatedPrefix = useId().replace(/:/gu, "");
  const resolvedPrefix = tabIdPrefix ?? `content-tab-${generatedPrefix}`;

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
    if (!tabs.length) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % tabs.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    onChange(nextIndex);
    requestAnimationFrame(() => {
      const nextTabId = tabs[nextIndex]?.id ?? `${resolvedPrefix}-${nextIndex}`;
      document.getElementById(nextTabId)?.focus();
    });
  }

  return (
    <div
      className={["sh-content-tabs", "job-detail-tab-list", className]
        .filter(Boolean)
        .join(" ")}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab, index) => {
        const selected = index === activeIndex;
        const id = tab.id ?? `${resolvedPrefix}-${index}`;
        return (
          <button
            key={id}
            className={[
              "sh-content-tab",
              "job-detail-tab",
              selected ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            id={id}
            type="button"
            role="tab"
            aria-controls={panelId}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(index)}
            onKeyDown={moveFocus}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
