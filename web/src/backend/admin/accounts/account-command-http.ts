import "server-only";
import { z } from "zod";
import {
  privilegedReasonCategorySchema,
  normalizedText,
} from "@/shared/contracts/admin/common";
import {
  commandHeaders,
  AdminHttpError,
  parseAdminJson,
} from "@/backend/admin/http/admin-route";

const bodySchema = z
  .object({
    confirmation: z.literal(true),
    reasonCategory: privilegedReasonCategorySchema,
    explanation: normalizedText(10, 500),
  })
  .strict();
export async function readAccountCommand(request: Request) {
  const body = await parseAdminJson(request, bodySchema);
  const headers = commandHeaders(request);
  if (
    !headers.idempotencyKey ||
    !Number.isInteger(headers.expectedVersion) ||
    headers.expectedVersion < 1
  )
    throw new AdminHttpError(400, "VALIDATION_FAILED");
  return { ...body, ...headers };
}
