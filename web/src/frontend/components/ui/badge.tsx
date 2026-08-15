import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "blue"
  | "teal"
  | "amber";

const toneIcons: Record<BadgeTone, string> = {
  neutral: "•",
  info: "i",
  success: "✓",
  warning: "!",
  error: "!",
  blue: "",
  teal: "✓",
  amber: "!",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  icon,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  if (icon) {
    const iconTone =
      tone === "blue" || tone === "teal" || tone === "amber" ? tone : "neutral";
    return (
      <span
        className={["sh-icon-badge", className].filter(Boolean).join(" ")}
        data-tone={iconTone}
        {...props}
      >
        {icon}
      </span>
    );
  }

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
