import "server-only";
import { z } from "zod";
import {
  membershipRoleSchema,
  normalizedText,
  verificationRejectionCategorySchema,
} from "@/shared/contracts/admin/common";
import {
  commandHeaders,
  AdminHttpError,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";
const reject = z
  .object({
    category: verificationRejectionCategorySchema,
    applicantComment: normalizedText(10, 500),
    protectedNote: normalizedText(0, 2000).optional(),
  })
  .strict();
const approve = z
  .object({
    role: membershipRoleSchema.optional(),
    protectedNote: normalizedText(0, 2000).optional(),
  })
  .strict();
export async function readVerificationCommand(
  request: Request,
  action: "reject" | "approve",
) {
  const schema: z.ZodType<Record<string, unknown>> = (
    action === "reject" ? reject : approve
  ) as z.ZodType<Record<string, unknown>>;
  const body = await parseAdminJson(request, schema);
  const headers = commandHeaders(request, { strictIfMatch: true });
  if (
    headers.idempotencyKey.length < 16 ||
    headers.idempotencyKey.length > 128 ||
    !Number.isInteger(headers.expectedVersion) ||
    headers.expectedVersion < 1
  )
    throw new AdminHttpError(400, "VALIDATION_FAILED");
  if (action === "reject") {
    const rejection = body as {
      applicantComment?: string;
      protectedNote?: string;
    };
    return {
      ...body,
      reason: rejection.applicantComment,
      privateNote: rejection.protectedNote,
      ...headers,
    };
  }
  const approval = body as { protectedNote?: string };
  return {
    ...body,
    privateNote: approval.protectedNote,
    ...headers,
  };
}
