import "server-only";
import { createHash } from "node:crypto";
import {
  jobReviewSnapshotSchema,
  type JobReviewSnapshot,
} from "@/shared/contracts/recruiter-job-posting";
import type { JobPostReviewState } from "@/shared/contracts/admin/job-post-review";
import type { JobCatalogItem } from "@/shared/contracts/jobs/catalog";

export const JOB_REVIEW_SNAPSHOT_SCHEMA_VERSION = "1";

function normalizeValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        normalizeValue(nested),
      ]),
    );
  return value;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function normalizeJobReviewSnapshot(value: unknown): JobReviewSnapshot {
  return jobReviewSnapshotSchema.parse(normalizeValue(value));
}

export function jobReviewSnapshotFromCatalog(
  value: JobCatalogItem,
  authoritativeCompanyId: string,
) {
  const candidate = {
    ...value,
    companyId: authoritativeCompanyId,
  } as Record<string, unknown>;
  for (const field of [
    "status",
    "approvalComment",
    "isVerified",
    "postedAt",
    "updatedAt",
    "stats",
  ])
    delete candidate[field];
  return normalizeJobReviewSnapshot(candidate);
}

export function jobReviewSnapshotSha256(value: unknown): string {
  const snapshot = normalizeJobReviewSnapshot(value);
  return createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
}

export function jobReviewMaterialIdentity(value: unknown): string {
  return `${JOB_REVIEW_SNAPSHOT_SCHEMA_VERSION}:${jobReviewSnapshotSha256(value)}`;
}

export function canTransitionJobPostReview(
  current: JobPostReviewState,
  target: JobPostReviewState,
): boolean {
  return (
    current === "PENDING_REVIEW" &&
    (target === "APPROVED" || target === "REJECTED")
  );
}
