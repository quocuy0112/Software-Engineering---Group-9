"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

function companyInitials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function companyTone(name: string) {
  const hash = [...name].reduce(
    (value, character) => value + character.codePointAt(0)!,
    0,
  );
  return hash % 5;
}

export function HomeCompanyMark({
  name,
  logoUrl,
  compact = false,
}: {
  name: string;
  logoUrl: string | null;
  compact?: boolean;
}) {
  const [loadedLogoUrl, setLoadedLogoUrl] = useState<string | null>(null);
  const classes = [
    "home-job-company-mark",
    `home-job-company-mark--tone-${companyTone(name)}`,
    compact ? "home-job-company-mark--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!logoUrl) return;

    let active = true;
    const probe = new window.Image();
    probe.onload = () => {
      if (active) setLoadedLogoUrl(logoUrl);
    };
    probe.onerror = () => {
      if (active) setLoadedLogoUrl(null);
    };
    probe.src = logoUrl;
    return () => {
      active = false;
    };
  }, [logoUrl]);

  if (loadedLogoUrl === logoUrl && logoUrl)
    return (
      <Image
        className={classes}
        src={logoUrl}
        alt=""
        width={compact ? 34 : 40}
        height={compact ? 34 : 40}
        unoptimized
        onError={() => setLoadedLogoUrl(null)}
      />
    );

  return (
    <span className={classes} aria-hidden="true">
      {companyInitials(name)}
    </span>
  );
}
