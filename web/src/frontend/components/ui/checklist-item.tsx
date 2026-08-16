import type { ReactNode } from "react";

export function ChecklistItem({ text }: { text: ReactNode }) {
  return (
    <li className="sh-checklist-item">
      <span className="job-bullet-marker" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m5 12 4 4L19 6" />
        </svg>
      </span>
      <span className="sh-checklist-item__text">{text}</span>
    </li>
  );
}
