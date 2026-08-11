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
const changes = z
  .object({
    confirmation: z.literal(true),
    guidance: normalizedText(10, 500),
    privateNote: normalizedText(0, 2000).optional(),
  })
  .strict();
const reject = z
  .object({
    confirmation: z.literal(true),
    category: verificationRejectionCategorySchema,
    reason: normalizedText(10, 500),
    privateNote: normalizedText(0, 2000).optional(),
  })
  .strict();
const approve = z
  .object({
    confirmation: z.literal(true),
    role: membershipRoleSchema,
    privateNote: normalizedText(0, 2000).optional(),
  })
  .strict();
export async function readVerificationCommand(
  request: Request,
  action: "request-changes" | "reject" | "approve",
) {
  const schema: z.ZodType<Record<string, unknown>> = (
    action === "request-changes"
      ? changes
      : action === "reject"
        ? reject
        : approve
  ) as z.ZodType<Record<string, unknown>>;
  const body = await parseAdminJson(request, schema);
  const headers = commandHeaders(request);
  if (
    !headers.idempotencyKey ||
    !Number.isInteger(headers.expectedVersion) ||
    headers.expectedVersion < 1
  )
    throw new AdminHttpError(400, "VALIDATION_FAILED");
  return { ...body, ...headers };
}
