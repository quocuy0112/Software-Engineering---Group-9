export const migrationNameMap = Object.freeze([
  ["20260807081414_smarthire", "013_application_metadata"],
  [
    "20260808090000_canonical_application_tracking",
    "014_canonical_application_tracking",
  ],
  ["20260808090000_user_job_workspace_state", "015_user_job_workspace_state"],
  ["20260810090000_admin_management", "016_admin_management"],
  ["20260810100000_admin_account_version", "017_admin_account_version"],
  [
    "20260810110000_moderation_priority_alignment",
    "018_moderation_priority_alignment",
  ],
  ["20260810120000_evidence_processing_lease", "019_evidence_processing_lease"],
  [
    "20260810130000_verification_outbox_event_unique",
    "020_verification_outbox_event_unique",
  ],
  ["20260813061054_smarthire", "031_smarthire"],
  ["20260814131732_smarthire", "031_smarthire"],
  [
    "20260814090000_unified_in_app_notifications",
    "032_unified_in_app_notifications",
  ],
]);

// These checksums are kept explicit so history reconciliation can accept only
// known equivalent migration content, then normalize it to the checksum of
// the checked-in migration SQL.
export const migrationChecksumAliases = Object.freeze({
  // The old checked-in 031 SQL replayed objects already owned by 025/026/029/030.
  "031_smarthire": Object.freeze([
    "69c9f9bad3f1bd228d639fd8143cfec7c153c2114c55584a5408913e0ef0a4f7",
  ]),
  "20260813061054_smarthire": Object.freeze([
    "69c9f9bad3f1bd228d639fd8143cfec7c153c2114c55584a5408913e0ef0a4f7",
  ]),
  // This database migration was generated from the same 031 schema state before
  // the repository adopted stable numeric migration names.
  "20260814131732_smarthire": Object.freeze([
    "37bfd88f3db24b583690dfff1df684d1be77477665f105d21c111abc3dfd1e43",
  ]),
});
