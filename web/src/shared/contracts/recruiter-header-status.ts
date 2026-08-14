import { z } from "zod";

export const recruiterHeaderStateSchema = z.enum([
  "NEVER_APPLIED",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "APPROVED",
]);

export const recruiterHeaderDestinationKindSchema = z.enum([
  "NONE",
  "EMPLOYER_VERIFICATION",
  "RECRUITER_WORKSPACE",
]);

const observedAtSchema = z.string().datetime({ offset: true });

export const recruiterHeaderStatusSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("NEVER_APPLIED"),
      destinationKind: z.literal("EMPLOYER_VERIFICATION"),
      href: z.literal("/dashboard/employer-verification"),
      observedAt: observedAtSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("PENDING_REVIEW"),
      destinationKind: z.literal("NONE"),
      href: z.null(),
      observedAt: observedAtSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("CHANGES_REQUESTED"),
      destinationKind: z.literal("EMPLOYER_VERIFICATION"),
      href: z.literal("/dashboard/employer-verification"),
      observedAt: observedAtSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("REJECTED"),
      destinationKind: z.literal("EMPLOYER_VERIFICATION"),
      href: z.literal("/dashboard/employer-verification"),
      observedAt: observedAtSchema,
    })
    .strict(),
  z
    .object({
      state: z.literal("APPROVED"),
      destinationKind: z.literal("RECRUITER_WORKSPACE"),
      href: z.string().url(),
      observedAt: observedAtSchema,
    })
    .strict(),
]);

export const recruiterHeaderErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "UNAVAILABLE",
  "STATUS_UNAVAILABLE",
]);

export const recruiterHeaderErrorSchema = z
  .object({
    code: recruiterHeaderErrorCodeSchema,
  })
  .strict();

export type RecruiterHeaderState = z.infer<typeof recruiterHeaderStateSchema>;
export type RecruiterHeaderDestinationKind = z.infer<
  typeof recruiterHeaderDestinationKindSchema
>;
export type RecruiterHeaderStatus = z.infer<typeof recruiterHeaderStatusSchema>;
export type RecruiterHeaderError = z.infer<typeof recruiterHeaderErrorSchema>;

export const EMPLOYER_VERIFICATION_HREF =
  "/dashboard/employer-verification" as const;

export function parseRecruiterHeaderStatus(value: unknown) {
  return recruiterHeaderStatusSchema.parse(value);
}
