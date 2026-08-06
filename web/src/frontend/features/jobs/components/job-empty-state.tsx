import Link from "next/link";

type EmptyStateIllustration = "folder" | "headset" | "preferences";

function EmptyIllustration({ type }: { type: EmptyStateIllustration }) {
  if (type === "headset") {
    return (
      <svg viewBox="0 0 96 80" aria-hidden="true">
        <circle cx="48" cy="39" r="20" />
        <path d="M22 41V35a26 26 0 0 1 52 0v6M18 41h8v16h-4a4 4 0 0 1-4-4zM78 41h-8v16h4a4 4 0 0 0 4-4zM70 59c-4 8-13 11-22 11" />
        <path d="M42 29c3-3 9-3 12 0M40 46h16" />
      </svg>
    );
  }
  if (type === "preferences") {
    return (
      <svg viewBox="0 0 96 80" aria-hidden="true">
        <path d="M17 22h62v43H17zM24 15h48M31 31h34M31 42h18M31 53h25" />
        <circle cx="68" cy="51" r="9" />
        <path d="M68 46v10M63 51h10" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 80" aria-hidden="true">
      <path d="M12 24h27l7 8h38v36H12z" />
      <path d="M12 32h72M38 45c3-4 9-4 12 0M36 55c4-3 8-3 12 0M60 45h8M60 55h8" />
      <circle cx="48" cy="57" r="1.5" />
    </svg>
  );
}

export function EmptyState({
  illustration,
  title,
  description,
  cta,
}: {
  illustration: EmptyStateIllustration;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <section className="workspace-empty-state" aria-live="polite">
      <span className="workspace-empty-illustration">
        <EmptyIllustration type={illustration} />
      </span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {cta ? (
        <Link
          className="dashboard-hero-cta workspace-empty-cta"
          href={cta.href}
        >
          {cta.label}
        </Link>
      ) : null}
    </section>
  );
}
