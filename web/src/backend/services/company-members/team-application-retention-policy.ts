import "server-only";

// Team Application CVs are decision evidence, not a permanent candidate
// profile. Keep them for the same short post-decision window used by ordinary
// application documents, then make the document inaccessible and delete the
// private-storage object asynchronously.
export const TEAM_APPLICATION_CV_RETENTION_MS = 30 * 24 * 60 * 60_000;

export function teamApplicationCvDeleteAfter(at: Date): Date {
  if (Number.isNaN(at.getTime())) throw new Error("TEAM_CV_CLOCK_INVALID");
  return new Date(at.getTime() + TEAM_APPLICATION_CV_RETENTION_MS);
}
