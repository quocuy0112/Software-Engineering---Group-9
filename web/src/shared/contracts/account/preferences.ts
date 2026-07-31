import { z } from "zod";

export const preferenceLanguageSchema = z.enum(["vi", "en"]);

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
  });
}

export const preferenceTimezoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine(
    (value) => value === value.trim() && !hasControlCharacter(value),
    "Enter a valid timezone.",
  );

export const notificationPreferencesSchema = z
  .object({
    application_updates: z.boolean(),
    job_recommendations: z.boolean(),
    account_security: z.literal(true),
  })
  .strict();

export const accountPreferencesMutationSchema = z
  .object({
    language: preferenceLanguageSchema,
    timezone: preferenceTimezoneSchema,
    emailNotifications: notificationPreferencesSchema,
  })
  .strict();

export const accountPreferencesSchema = accountPreferencesMutationSchema
  .extend({
    timezoneSupported: z.boolean(),
  })
  .strict();

export const accountPreferencesMutationOutcomeSchema = z
  .object({
    preferences: accountPreferencesSchema,
    message: z.string().min(1).max(240),
  })
  .strict();

export const ACCOUNT_PREFERENCES_DEFAULTS = Object.freeze({
  language: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  emailNotifications: Object.freeze({
    application_updates: true,
    job_recommendations: true,
    account_security: true,
  }),
}) satisfies z.infer<typeof accountPreferencesMutationSchema>;

export type AccountPreferencesMutation = z.infer<
  typeof accountPreferencesMutationSchema
>;
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
export type AccountPreferencesMutationOutcome = z.infer<
  typeof accountPreferencesMutationOutcomeSchema
>;
