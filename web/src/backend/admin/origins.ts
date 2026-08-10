import "server-only";
import { loadAdminConfiguration } from "./config";

export type ProductOrigin = "candidate" | "admin" | "recruiter";

export function configuredOrigins(input: NodeJS.ProcessEnv = process.env) {
  const config = loadAdminConfiguration(input);
  return Object.freeze({
    candidate: config.CANDIDATE_ORIGIN,
    admin: config.ADMIN_ORIGIN,
    recruiter: config.RECRUITER_ORIGIN,
  });
}

export function classifyOrigin(
  origin: string,
  input: NodeJS.ProcessEnv = process.env,
): ProductOrigin | null {
  const exact = new URL(origin).origin;
  const origins = configuredOrigins(input);
  return (
    (Object.entries(origins).find(([, value]) => value === exact)?.[0] as
      | ProductOrigin
      | undefined) ?? null
  );
}
