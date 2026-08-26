import { z } from "zod";
import { profileVisibilitySectionSchema } from "@/shared/contracts/account/profile";

export const profileLookupQuerySchema = z
  .object({ userId: z.string().trim().min(1).max(128) })
  .strict();

export const discoverableProfileSchema = z
  .object({
    userId: z.string().min(1).max(128),
    displayName: z.string().min(1).max(120),
    image: z.string().url().nullable(),
    sections: z
      .object({
        headline: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        skills: z.array(z.string().min(1).max(80)).optional(),
        experience: z
          .array(
            z.object({
              title: z.string().max(200),
              company: z.string().max(200),
            }),
          )
          .optional(),
        education: z
          .array(
            z.object({
              institution: z.string().max(200),
              degree: z.string().max(200),
            }),
          )
          .optional(),
        links: z.array(z.string().url()).optional(),
      })
      .strict(),
  })
  .strict();

export const profileLookupResponseSchema = z
  .object({ result: discoverableProfileSchema.nullable() })
  .strict();

export const profileVisibilitySectionListSchema = z
  .array(profileVisibilitySectionSchema)
  .max(8)
  .transform((values) => [...new Set(values)]);

export type DiscoverableProfile = z.infer<typeof discoverableProfileSchema>;
