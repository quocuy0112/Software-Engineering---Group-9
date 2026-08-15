import { ArrowRight, Check, Plus } from "lucide-react";

export function ChecklistRow({
  status,
  title,
  subtitle,
  onClick,
}: {
  status: "done" | "todo";
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const complete = status === "done";

  return (
    <li className="sh-checklist-row" data-status={status}>
      <button type="button" onClick={onClick}>
        <span className="sh-checklist-row__icon" aria-hidden="true">
          {complete ? <Check /> : <Plus />}
        </span>
        <span className="sh-checklist-row__copy">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
        <ArrowRight className="sh-checklist-row__arrow" aria-hidden="true" />
      </button>
    </li>
  );
}
