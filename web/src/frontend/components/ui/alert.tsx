import type { HTMLAttributes, ReactNode } from "react";

export type AlertTone = "info" | "success" | "warning" | "error";

const toneIcons: Record<AlertTone, string> = {
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
};

export function Alert({
  tone = "info",
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  children: ReactNode;
}) {
  return (
    <div
      className={["sh-alert", className].filter(Boolean).join(" ")}
      data-tone={tone}
      {...props}
    >
      <span className="sh-alert-icon" aria-hidden="true">
        {toneIcons[tone]}
      </span>
      <div className="sh-alert-content">{children}</div>
    </div>
  );
}
