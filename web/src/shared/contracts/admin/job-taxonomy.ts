import { z } from "zod";
import { normalizedText, privilegedReasonCategorySchema } from "./common";

export const jobTaxonomyStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "REMOVED",
]);

export const jobTaxonomyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().min(1).max(200).optional(),
  status: jobTaxonomyStatusSchema.optional(),
  industryCode: z.string().trim().min(1).max(80).optional(),
});

const commandShape = {
  confirmation: z.literal(true),
  reasonCategory: privilegedReasonCategorySchema,
  explanation: normalizedText(10, 500),
};

export const jobTaxonomyCommandSchema = z.discriminatedUnion("command", [
  z.object({ command: z.literal("DEACTIVATE"), ...commandShape }).strict(),
  z.object({ command: z.literal("REACTIVATE"), ...commandShape }).strict(),
  z.object({ command: z.literal("REMOVE"), ...commandShape }).strict(),
]);

export type JobTaxonomyListQuery = z.infer<typeof jobTaxonomyListQuerySchema>;
export type JobTaxonomyCommand = z.infer<typeof jobTaxonomyCommandSchema>;
