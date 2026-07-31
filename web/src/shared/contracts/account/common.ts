import { z } from "zod";

export const accountErrorCodeSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9_]+$/u);

export const fieldPathSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z][A-Za-z0-9_.[\]-]*$/u);

export const fieldErrorMessagesSchema = z
  .array(z.string().min(1).max(240))
  .min(1)
  .max(5);

export const fieldErrorsSchema = z
  .record(fieldPathSchema, fieldErrorMessagesSchema)
  .refine((value) => Object.keys(value).length <= 25, {
    message: "Too many field errors.",
  });

export const retryMetadataSchema = z
  .object({
    retryAfterSeconds: z.number().int().min(1).max(86_400),
  })
  .strict();

export const accountErrorSchema = z
  .object({
    code: accountErrorCodeSchema,
    message: z.string().min(1).max(240),
    fieldErrors: fieldErrorsSchema.optional(),
    retryAfterSeconds: z.number().int().min(1).max(86_400).optional(),
  })
  .strict();

export const idempotencyKeySchema = z
  .string()
  .min(20)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);

export const correlationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/u);

export type AccountError = z.infer<typeof accountErrorSchema>;
export type FieldErrors = z.infer<typeof fieldErrorsSchema>;
