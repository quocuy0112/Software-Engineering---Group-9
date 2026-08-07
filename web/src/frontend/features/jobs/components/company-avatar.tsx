"use client";

import { useState } from "react";

type CompanyAvatarProps = {
  name: string | null | undefined;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  loading?: "eager" | "lazy";
};

const avatarTones = [
  "blue",
  "indigo",
  "sky",
  "violet",
  "teal",
  "slate",
] as const;

function avatarTone(name: string) {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return avatarTones[Math.abs(hash) % avatarTones.length];
}

export function CompanyAvatar({
  name,
  imageUrl,
  size = "md",
  className,
  loading = "lazy",
}: CompanyAvatarProps) {
  const displayName = name?.trim() || "Company";
  const source = imageUrl?.trim() || null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(source && source !== failedSource);
  const classes = ["company-avatar", "company-avatar--" + size, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      data-avatar-tone={avatarTone(displayName)}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={source ?? undefined}
          alt=""
          loading={loading}
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span>{displayName.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}
