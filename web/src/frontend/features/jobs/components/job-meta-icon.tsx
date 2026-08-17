import type { SVGProps } from "react";

export type JobMetaIconName =
  | "location"
  | "person"
  | "experience"
  | "deadline"
  | "level"
  | "education"
  | "hires"
  | "arrangement"
  | "employment"
  | "company-size"
  | "industry";

export function JobMetaIcon({
  name,
  ...props
}: { name: JobMetaIconName } & SVGProps<SVGSVGElement>) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" className="job-meta-svg" {...props}>
      {name === "location" ? (
        <>
          <path
            {...common}
            d="M19 10.3c0 5-7 10.7-7 10.7S5 15.3 5 10.3a7 7 0 1 1 14 0Z"
          />
          <circle {...common} cx="12" cy="10" r="2.35" />
        </>
      ) : null}
      {name === "experience" ? (
        <>
          <rect {...common} x="4" y="7" width="16" height="12" rx="2" />
          <path
            {...common}
            d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7M4 12h16M10 12v1h4v-1"
          />
        </>
      ) : null}
      {name === "person" ? (
        <>
          <circle {...common} cx="12" cy="8" r="3.5" />
          <path {...common} d="M4.5 20c.6-3.5 3.3-5.5 7.5-5.5s6.9 2 7.5 5.5" />
        </>
      ) : null}
      {name === "deadline" ? (
        <>
          <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
          <path {...common} d="M8 3v4M16 3v4M4 10h16M12 13v3l2 1" />
        </>
      ) : null}
      {name === "level" ? (
        <path {...common} d="M5 17 11 11l3 3 5-6M15 8h4v4" />
      ) : null}
      {name === "education" ? (
        <>
          <path {...common} d="m3 9 9-5 9 5-9 5-9-5Z" />
          <path {...common} d="M7 11.2V16c2.9 2 7.1 2 10 0v-4.8M21 9v6" />
        </>
      ) : null}
      {name === "hires" ? (
        <>
          <circle {...common} cx="9" cy="9" r="3" />
          <path
            {...common}
            d="M3.8 19a5.2 5.2 0 0 1 10.4 0M16 7.2a2.7 2.7 0 0 1 0 5.2M17.5 14.2A4.7 4.7 0 0 1 20.2 19"
          />
        </>
      ) : null}
      {name === "arrangement" ? (
        <>
          <rect {...common} x="3" y="5" width="18" height="12" rx="2" />
          <path {...common} d="M8 21h8M12 17v4" />
        </>
      ) : null}
      {name === "employment" ? (
        <>
          <rect {...common} x="4" y="7" width="16" height="12" rx="2" />
          <path
            {...common}
            d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7M4 12h16"
          />
        </>
      ) : null}
      {name === "company-size" ? (
        <>
          <circle {...common} cx="9" cy="8.5" r="3" />
          <path
            {...common}
            d="M3.8 19a5.2 5.2 0 0 1 10.4 0M16.2 6.2a2.8 2.8 0 0 1 0 5.4M17.4 14.3a4.8 4.8 0 0 1 2.8 4.7"
          />
        </>
      ) : null}
      {name === "industry" ? (
        <>
          <path {...common} d="M4 20V6h10v14M14 10h6v10M2 20h20" />
          <path {...common} d="M8 10h2M8 14h2M16.5 14h1M16.5 17h1" />
        </>
      ) : null}
    </svg>
  );
}
