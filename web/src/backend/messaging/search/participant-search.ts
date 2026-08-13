import "server-only";
import { z } from "zod";
import { normalizeEmail } from "@/shared/contracts/identity/registration";

const accountIdSchema = z.uuid();
const exactEmailSchema = z.string().trim().max(320).email();

export type ParticipantSearchFilter =
  | { id: string }
  | { normalizedEmail: string }
  | { name: { contains: string; mode: "insensitive" } }
  | Record<string, never>;

export function buildParticipantSearchFilter(
  query: string | undefined,
): ParticipantSearchFilter {
  const normalizedQuery = query?.trim().normalize("NFKC");
  if (!normalizedQuery) return {};

  if (accountIdSchema.safeParse(normalizedQuery).success) {
    return { id: normalizedQuery.toLocaleLowerCase("en-US") };
  }

  if (exactEmailSchema.safeParse(normalizedQuery).success) {
    return { normalizedEmail: normalizeEmail(normalizedQuery) };
  }

  return {
    name: { contains: normalizedQuery, mode: "insensitive" },
  };
}
