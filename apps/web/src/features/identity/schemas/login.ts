import { z } from "zod";
import { normalizeEmail } from "./registration";
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(320)
      .email("Enter a valid email address.")
      .transform(normalizeEmail),
    password: z.string().min(1, "Enter your password.").max(128),
    returnTo: z.string().max(2048).optional(),
  })
  .strict();
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;
