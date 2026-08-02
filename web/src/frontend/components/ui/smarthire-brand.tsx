import Link from "next/link";

export function SmartHireMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={["brand-mark", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" focusable="false">
        <path
          className="brand-mark-frame"
          d="M10.25 7.75h15.5a2.5 2.5 0 0 1 2.5 2.5v15.5a2.5 2.5 0 0 1-2.5 2.5h-15.5a2.5 2.5 0 0 1-2.5-2.5v-15.5a2.5 2.5 0 0 1 2.5-2.5Z"
        />
        <path
          className="brand-mark-letter"
          d="M24.5 12.1h-8.1a3.4 3.4 0 1 0 0 6.8h3.2a3.4 3.4 0 1 1 0 6.8h-8.1"
        />
        <circle className="brand-mark-node" cx="24.6" cy="12.1" r="1.35" />
        <circle className="brand-mark-node" cx="11.4" cy="25.7" r="1.35" />
      </svg>
    </span>
  );
}

export function SmartHireBrand({ className = "" }: { className?: string }) {
  return (
    <Link
      className={["smart-hire-brand", className].filter(Boolean).join(" ")}
      href="/"
      aria-label="SmartHire home"
    >
      <SmartHireMark />
      <span className="smart-hire-brand-name">SmartHire</span>
    </Link>
  );
}
