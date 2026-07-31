import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "error";

const toneIcons: Record<BadgeTone, string> = {
  neutral: "•",
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={["sh-badge", className].filter(Boolean).join(" ")}
      data-tone={tone}
      {...props}
    >
      <span className="sh-badge-icon" aria-hidden="true">
        {toneIcons[tone]}
      </span>
      <span>{children}</span>
    </span>
  );
}
