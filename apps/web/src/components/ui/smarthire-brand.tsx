import Link from "next/link";

export function SmartHireBrand({ className = "" }: { className?: string }) {
  return (
    <Link
      className={["smart-hire-brand", className].filter(Boolean).join(" ")}
      href="/"
      aria-label="SmartHire home"
    >
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      <span>SmartHire</span>
    </Link>
  );
}
