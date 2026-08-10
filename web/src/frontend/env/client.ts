import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_ADMIN_ORIGIN: z.string().url().optional(),
  NEXT_PUBLIC_RECRUITER_ORIGIN: z.string().url().optional(),
});
export const clientEnvironment = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ADMIN_ORIGIN: process.env.NEXT_PUBLIC_ADMIN_ORIGIN,
  NEXT_PUBLIC_RECRUITER_ORIGIN: process.env.NEXT_PUBLIC_RECRUITER_ORIGIN,
});

export const clientOrigins = Object.freeze({
  candidate: new URL(clientEnvironment.NEXT_PUBLIC_APP_URL).origin,
  admin: new URL(
    clientEnvironment.NEXT_PUBLIC_ADMIN_ORIGIN ??
      "http://console.admin.localhost:3001",
  ).origin,
  recruiter: new URL(
    clientEnvironment.NEXT_PUBLIC_RECRUITER_ORIGIN ??
      "http://console.recruiter.localhost:3001",
  ).origin,
});
