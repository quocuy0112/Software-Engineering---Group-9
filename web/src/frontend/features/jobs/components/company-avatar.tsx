"use client";

import Image from "next/image";
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

function companyInitials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

function displayableImageSource(value: string | null | undefined) {
  const source = value?.trim();
  if (!source) return null;

  // The application image policy permits same-origin and inline raster images.
  // Avoid rendering remote placeholders as broken images while preserving a
  // deterministic monogram for companies without a displayable logo.
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,/iu.test(source)) {
    return source;
  }
  return null;
}

export function CompanyAvatar({
  name,
  imageUrl,
  size = "md",
  className,
  loading = "lazy",
}: CompanyAvatarProps) {
  const displayName = name?.trim() || "Company";
  const source = displayableImageSource(imageUrl);
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
        <Image
          src={source!}
          alt=""
          width={56}
          height={56}
          loading={loading}
          unoptimized={source?.startsWith("data:") ?? false}
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span>{companyInitials(displayName)}</span>
      )}
    </span>
  );
}
