import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "./badge";
import type { DesignTone } from "./design-system";

type FeatureCardProps = {
  icon: ReactNode;
  tone?: Extract<DesignTone, "blue" | "teal">;
  title: ReactNode;
  description: ReactNode;
  footer: ReactNode;
  href?: string;
  className?: string;
};

export function FeatureCard({
  icon,
  tone = "blue",
  title,
  description,
  footer,
  href,
  className = "",
}: FeatureCardProps) {
  const content = (
    <>
      <Badge icon={icon} tone={tone} aria-hidden="true" />
      <h2 className="sh-feature-card__title">{title}</h2>
      <p className="sh-feature-card__description">{description}</p>
      <span className="sh-feature-card__footer">{footer}</span>
    </>
  );
  const classes = ["sh-feature-card", className].filter(Boolean).join(" ");

  return href ? (
    <Link className={classes} href={href}>
      {content}
    </Link>
  ) : (
    <article className={classes}>{content}</article>
  );
}
