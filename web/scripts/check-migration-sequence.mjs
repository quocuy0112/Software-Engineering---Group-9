import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = resolve(webRoot, "prisma/migrations");
const entries = await readdir(migrationsRoot, { withFileTypes: true });
const names = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "en"));

const allowedLegacyMigrations = new Set(["20260816050940_smarthire"]);
const invalid = names.filter(
  (name) =>
    !allowedLegacyMigrations.has(name) &&
    !/^\d{3}_[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(name),
);
if (invalid.length) {
  throw new Error(
    `Migration directories must use NNN_snake_case: ${invalid.join(", ")}`,
  );
}

const allowedDuplicateVersions = new Set([
  "022_admin_user_management_refinement|022_realtime_messaging",
  // Legacy migrations created concurrently on separate feature branches.
  // Prisma identifies migrations by the full directory name, so preserve those
  // immutable names and document each intentional duplicate explicitly.
  "034_notification_locale_payload|034_submitted_candidates",
  "035_actionable_admin_notifications|035_candidate_hybrid_ranking",
  "038_admin_job_post_management|038_ai_assessment_v5_consistency",
  "039_candidate_application_private_match|039_job_post_management_correction_invariant",
  "040_notification_recipient_role_and_job_post_changes|040_private_match_trigger_identifier_fix",
]);
const versionedNames = names
  .filter((name) => !allowedLegacyMigrations.has(name))
  .map((name) => ({
    version: Number(name.slice(0, 3)),
    name,
  }));
const outOfSequence = versionedNames.flatMap((entry, index) => {
  if (index === 0) return entry.version === 1 ? [] : [entry];
  const previous = versionedNames[index - 1];
  if (entry.version === previous.version) {
    const duplicatePair = `${previous.name}|${entry.name}`;
    return allowedDuplicateVersions.has(duplicatePair) ? [] : [entry];
  }
  return entry.version === previous.version + 1 ? [] : [entry];
});
if (outOfSequence.length) {
  throw new Error(
    `Migration sequence has gaps or duplicates: ${outOfSequence
      .map(
        (entry) =>
          `${entry.name} (unexpected version ${String(entry.version).padStart(3, "0")})`,
      )
      .join(", ")}`,
  );
}

console.log(
  JSON.stringify(
    {
      migrationCount: names.length,
      first: names.at(0),
      last: names.at(-1),
      namingConvention: "NNN_snake_case",
      pass: true,
    },
    null,
    2,
  ),
);
