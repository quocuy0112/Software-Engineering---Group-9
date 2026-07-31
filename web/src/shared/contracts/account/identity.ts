import { z } from "zod";
import { normalizationWarningSchema } from "./profile";

const isoInstantSchema = z.string().datetime({ offset: true });

export const pendingEmailChangeSchema = z
  .object({
    proposedEmail: z.string().max(320).email(),
    expiresAt: isoInstantSchema,
  })
  .strict();

export const accountIdentitySchema = z
  .object({
    name: z.string().min(1).max(150),
    email: z.string().max(320).email(),
    emailVerified: z.boolean(),
    accountState: z.literal("ACTIVE"),
    createdAt: isoInstantSchema,
    pendingEmailChange: pendingEmailChangeSchema.nullable(),
  })
  .strict();

export const accountNameMutationSchema = z
  .object({
    name: z.string().min(1).max(150),
  })
  .strict();

export const accountIdentityMutationOutcomeSchema = z
  .object({
    identity: accountIdentitySchema,
    warnings: z.array(normalizationWarningSchema).max(5),
    message: z.string().min(1).max(240),
  })
  .strict();

export type PendingEmailChange = z.infer<typeof pendingEmailChangeSchema>;
export type AccountIdentity = z.infer<typeof accountIdentitySchema>;
export type AccountNameMutation = z.infer<typeof accountNameMutationSchema>;
export type AccountIdentityMutationOutcome = z.infer<
  typeof accountIdentityMutationOutcomeSchema
>;
