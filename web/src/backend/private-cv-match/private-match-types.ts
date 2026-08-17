import type { Prisma } from "@/backend/generated/prisma/client";

export type PrivateCvSnapshot = Readonly<{
  versionId: string;
  version: number;
  displayName: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  pageCount: number | null;
  parseStatus: "READY" | "PARTIAL" | "FAILED";
  confirmedAt: string;
  checksumSha256: string;
}>;

export type PrivateJdSnapshot = Readonly<{
  jobId: string;
  slug: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  workArrangement: string;
  requiredExperienceYears: number | null;
  requirements: readonly string[];
  requiredSkills: readonly { code: string; label: string }[];
  preferredSkills: readonly { code: string; label: string }[];
  requiredLanguages: readonly string[];
  jdVersion: number;
  jdUpdatedAt: string;
  jdText: string;
}>;

export function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
