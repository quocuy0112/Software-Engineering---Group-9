import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(import.meta.dirname, "../prisma/migrations/20260813130000_professional_connection_proposals/migration.sql"), "utf8");
const required = [
  "ProfessionalConnectionProposal",
  "ProfessionalConnectionDecision",
  "ProfessionalConnectionNotification",
  "ProfessionalConnectionCommandReceipt",
  "ProfessionalConnectionProposal_active_pair_key",
  "ProfessionalConnection_current_pair_key",
  "participantLowId\" < \"participantHighId",
  "archivedAt",
  "revokedAt",
];
const missing = required.filter((token) => !migration.includes(token));
if (missing.length) {
  console.error(`Migration is missing required constraints: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Professional connection migration contains canonical, uniqueness, lifecycle, archive, and retention primitives.");
}
