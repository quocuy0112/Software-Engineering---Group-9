import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export const registrationSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().max(320).email("Enter a valid email address.").transform(normalizeEmail),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
  passwordConfirmation: z.string().min(12).max(128),
}).strict().refine((value) => value.password === value.passwordConfirmation, { path: ["passwordConfirmation"], message: "Passwords do not match." });

export const emailSchema = z.object({ email: z.string().trim().max(320).email().transform(normalizeEmail) }).strict();
export const verificationTokenSchema = z.object({ token: z.string().min(32).max(1024) }).strict();
export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationData = z.output<typeof registrationSchema>;
