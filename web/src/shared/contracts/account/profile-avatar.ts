import { z } from "zod";

export const profileAvatarDataUrlSchema = z
  .string()
  .min(32)
  .max(1_100_000)
  .regex(
    /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/u,
    "Use a PNG or JPEG avatar.",
  );

export const profileAvatarMutationSchema = z
  .object({ image: profileAvatarDataUrlSchema })
  .strict();

export const profileAvatarResponseSchema = z.object({
  image: profileAvatarDataUrlSchema.nullable(),
  message: z.string(),
});

export type ProfileAvatarResponse = z.infer<typeof profileAvatarResponseSchema>;
