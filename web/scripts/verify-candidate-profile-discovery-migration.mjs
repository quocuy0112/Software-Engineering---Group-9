import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(import.meta.dirname, "../prisma/migrations/066_candidate_profile_discovery/migration.sql"), "utf8");
const required = ["CandidateProfileVisibility", "discoverableByExactId", "CandidateProfileVisibility_pkey", "JobApplicationContactConsent", "JobApplicationContactConsent_pkey", "profileSnapshotReviewDueAt", "profileSnapshotAccessDeniedAt", "ON DELETE CASCADE"];
const missing = required.filter((token) => !migration.includes(token));
if (missing.length) {
  console.error(`Migration is missing required primitives: ${missing.join(", ")}`);
  process.exitCode = 1;
} else console.log("Candidate profile discovery migration contains default-deny, consent, and retention primitives.");
