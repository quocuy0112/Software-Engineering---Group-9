import { z } from "zod";

export const ADMIN_STATE_DEFINITION_VERSION = "admin-state-v1" as const;
export const adminAccountStateSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "DELETED",
]);
export const administratorGrantStateSchema = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
  "EXPIRED",
]);
export const membershipRoleSchema = z.enum([
  "OWNER",
  "HR_MANAGER",
  "RECRUITER",
  "HIRING_MANAGER",
]);
export const membershipStateSchema = z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]);
export const verificationStateSchema = z.enum([
  "PENDING_CHECKS",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "RESUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);
export const moderationStateSchema = z.enum([
  "PENDING_REVIEW",
  "RESOLVED",
  "DISMISSED",
]);
export const privilegedReasonCategorySchema = z.enum([
  "SECURITY_COMPROMISE",
  "POLICY_VIOLATION",
  "USER_REQUEST",
  "VERIFICATION_FAILURE",
  "INCIDENT_RESOLVED",
  "ACCESS_CLEANUP",
  "OTHER",
]);
export const reportCategorySchema = z.enum([
  "FRAUD_OR_IMPERSONATION",
  "MISLEADING_CONTENT",
  "DISCRIMINATION_OR_HARASSMENT",
  "ABUSE_OR_THREATS",
  "SPAM_OR_DUPLICATE",
  "PRIVACY_OR_DATA_MISUSE",
  "OTHER",
]);
export const verificationRejectionCategorySchema = z.enum([
  "DOCUMENT_UNREADABLE",
  "TAX_ID_MISMATCH",
  "DOCUMENT_EXPIRED",
  "COMPANY_INFORMATION_MISMATCH",
  "DUPLICATE_OR_CONFLICTING_REQUEST",
  "POLICY_INELIGIBLE",
  "OTHER",
]);

export function normalizeAdminPlainText(value: string): string {
  const withoutMarkup = value
    .normalize("NFKC")
    .replace(/\r\n?/gu, "\n")
    .replace(/<(script|style|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1>/giu, "")
    .replace(/<[^>]*>/gu, "");
  const withoutControls = Array.from(withoutMarkup)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code <= 0x08 ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f) ||
        code === 0x7f ||
        (code >= 0x202a && code <= 0x202e) ||
        (code >= 0x2066 && code <= 0x2069)
      );
    })
    .join("");
  return withoutControls.replace(/\n{3,}/gu, "\n\n").trim();
}

export const normalizedText = (minimum: number, maximum: number) =>
  z
    .string()
    .transform(normalizeAdminPlainText)
    .pipe(z.string().min(minimum).max(maximum));

export const adminTimestampSchema = z.string().datetime({ offset: true });
export const adminReferenceSchema = z.string().min(1).max(128);
export const calculatedListMetadataSchema = z.object({
  calculatedAt: adminTimestampSchema,
  stateDefinitionVersion: z.literal(ADMIN_STATE_DEFINITION_VERSION),
});
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export const safeAdminErrorSchema = z.object({
  code: z.enum([
    "UNAVAILABLE",
    "UNAUTHORIZED",
    "STEP_UP_REQUIRED",
    "VALIDATION_FAILED",
    "STALE_CONFLICT",
    "RATE_LIMITED",
    "INTERNAL_FAILURE",
  ]),
  correlationId: adminReferenceSchema.optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export type SafeAdminError = z.infer<typeof safeAdminErrorSchema>;
