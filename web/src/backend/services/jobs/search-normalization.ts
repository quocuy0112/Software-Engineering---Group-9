import "server-only";
import { z } from "zod";
import { jobSortSchema } from "@/shared/contracts/jobs/discovery";

const cursorSchema = z
  .object({
    v: z.literal(1),
    sort: jobSortSchema,
    score: z.number().finite().optional(),
    publishedAt: z.string().datetime(),
    salaryMaximum: z
      .string()
      .regex(/^\d+(?:\.\d{1,2})?$/u)
      .nullable()
      .optional(),
    id: z.string().min(1).max(128),
  })
  .strict();

export type JobSearchCursor = z.infer<typeof cursorSchema>;

export function normalizeSearchText(value: string, maximum = 200): string {
  if (Array.from(value).length > maximum) {
    throw new Error("JOB_SEARCH_TEXT_TOO_LONG");
  }
  return value
    .normalize("NFD")
    .replace(/[đĐ]/gu, "d")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

/**
 * Public job locations are projected as "district, city" before being
 * normalized. Compose the same canonical value for a district-level filter
 * so it can be matched exactly instead of as a broad text fragment.
 */
export function normalizedDistrictLocation(
  city: string,
  district: string,
): string {
  return [district, city].filter(Boolean).join(" ");
}

export function encodeJobCursor(cursor: JobSearchCursor): string {
  const parsed = cursorSchema.parse(cursor);
  return Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");
}

export function decodeJobCursor(
  value: string,
  expectedSort: z.infer<typeof jobSortSchema>,
): JobSearchCursor {
  try {
    if (value.length > 1024) throw new Error();
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = cursorSchema.parse(JSON.parse(decoded));
    if (parsed.sort !== expectedSort) throw new Error();
    return parsed;
  } catch {
    throw new Error("JOB_SEARCH_CURSOR_INVALID");
  }
}
