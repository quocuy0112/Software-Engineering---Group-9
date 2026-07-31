import type { HTMLAttributes, ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div
      className={["sh-empty-state", className].filter(Boolean).join(" ")}
      {...props}
    >
      <span className="sh-empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}
