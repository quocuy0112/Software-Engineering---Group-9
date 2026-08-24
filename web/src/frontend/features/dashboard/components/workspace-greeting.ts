/**
 * Derives the short, friendly name used in the candidate-workspace greeting.
 * It deliberately does not persist or alter account data.
 */
export function getCandidateGreetingName(name: string) {
  const normalized = name.replace(/\s+/gu, " ").trim();
  return normalized ? (normalized.split(" ").at(-1) ?? "") : "";
}

export function getAccountInitials(name: string) {
  const normalized = name.replace(/\s+/gu, " ").trim();
  if (!normalized) return "SH";
  const parts = normalized.split(" ");
  const first = parts[0]?.at(0) ?? "";
  if (parts.length === 1) return first.toLocaleUpperCase();
  const last = parts.at(-1)?.at(0) ?? "";
  return `${first}${last}`.toLocaleUpperCase();
}
