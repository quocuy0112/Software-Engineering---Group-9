import "server-only";

import {
  candidateExportRowSchema,
  type CandidateExportRow,
} from "@/shared/contracts/analytics/exports";
import type { ExportDatabaseRow } from "@/backend/repositories/analytics/prisma-analytics-repository";

function snapshotValue(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "";
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function projectCandidateExportRow(row: ExportDatabaseRow): CandidateExportRow {
  const scoreAvailable =
    row.scoringState === "SCORED" && row.finalScore !== null;
  return candidateExportRowSchema.parse({
    applicationId: row.id,
    candidateName: snapshotValue(row.contactSnapshot, "fullName") || "Unavailable",
    email: snapshotValue(row.contactSnapshot, "email"),
    phone: snapshotValue(row.contactSnapshot, "phone"),
    applicationStatus: row.stage,
    cvScreeningScore: scoreAvailable ? String(row.finalScore) : "",
    scoreAvailability: scoreAvailable ? "AVAILABLE" : "UNAVAILABLE",
    submittedAt: row.submittedAt.toISOString(),
  });
}
