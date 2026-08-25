// The repository uses one canonical, contiguous migration sequence. These
// entries describe names that may still exist in an already-initialized
// database and need to be reconciled to the checked-in names.
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

  ["022_admin_user_management_refinement", "022_admin_user_management_refinement"],
  ["022_realtime_messaging", "023_realtime_messaging"],
  ["023_messaging_schema_name_alignment", "024_messaging_schema_name_alignment"],
  ["024_messaging_participant_search", "025_messaging_participant_search"],
  ["025_support_center", "026_support_center"],
  [
    "026_professional_connection_proposals",
    "027_professional_connection_proposals",
  ],
  [
    "027_align_professional_connection_index_names",
    "028_align_professional_connection_index_names",
  ],
  ["028_messaging_report_review", "029_messaging_report_review"],
  [
    "029_business_verification_enrichment",
    "030_business_verification_enrichment",
  ],
  [
    "030_business_verification_email_outbox_purpose",
    "031_business_verification_email_outbox_purpose",
  ],
  [
    "20260814090000_unified_in_app_notifications",
    "032_unified_in_app_notifications",
  ],
  ["032_unified_in_app_notifications", "032_unified_in_app_notifications"],
  [
    "033_email_outbox_retention_fk_cleanup",
    "033_email_outbox_retention_fk_cleanup",
  ],
  [
    "034_notification_locale_payload",
    "034_notification_locale_payload",
  ],
  ["034_submitted_candidates", "035_submitted_candidates"],
  [
    "035_actionable_admin_notifications",
    "036_actionable_admin_notifications",
  ],
  ["035_candidate_hybrid_ranking", "037_candidate_hybrid_ranking"],
  ["036_job_post_review_authority", "038_job_post_review_authority"],
  ["037_company_entity_type", "039_company_entity_type"],
  ["038_admin_job_post_management", "040_admin_job_post_management"],
  ["038_ai_assessment_v5_consistency", "041_ai_assessment_v5_consistency"],
  [
    "039_candidate_application_private_match",
    "042_candidate_application_private_match",
  ],
  [
    "039_job_post_management_correction_invariant",
    "043_job_post_management_correction_invariant",
  ],
  [
    "040_notification_recipient_role_and_job_post_changes",
    "044_notification_recipient_role_and_job_post_changes",
  ],
  [
    "040_private_match_trigger_identifier_fix",
    "045_private_match_trigger_identifier_fix",
  ],
  [
    "041_release_failed_private_match_dedupe",
    "046_release_failed_private_match_dedupe",
  ],
  ["042_candidate_application_workflow", "047_candidate_application_workflow"],
  ["043_waitlisted_public_application_outcome", "049_waitlisted_public_application_outcome"],
  [
    "044_private_match_retry_deterministic_pointer",
    "051_private_match_retry_deterministic_pointer",
  ],
  [
    "20260824051404_thanhtestnef",
    "065_prisma_schema_alignment",
  ],
]);

// These groups represent equivalent history shapes. The first two timestamp
// migrations were applied separately in some local databases, while the
// checked-in 043 migration contains their combined SQL. The title-search
// migration likewise existed under a timestamp name before receiving its
// stable numeric name.
export const migrationHistoryMergeGroups = Object.freeze([
  Object.freeze({
    currentName: "048_admin_timestamp_defaults_and_indexes",
    legacyNames: Object.freeze([
      "043_admin_timestamp_defaults_and_indexes",
      "20260816050940_smarthire",
      "20260817141725_smarthire",
      "20260818051344_smarthire",
    ]),
    completeLegacySets: Object.freeze([
      Object.freeze(["043_admin_timestamp_defaults_and_indexes"]),
      Object.freeze([
        "20260816050940_smarthire",
        "20260817141725_smarthire",
      ]),
      Object.freeze(["20260818051344_smarthire"]),
    ]),
  }),
  Object.freeze({
    currentName: "050_job_post_review_title_search",
    legacyNames: Object.freeze([
      "044_job_post_review_title_search",
      "20260818070000_job_post_review_title_search",
    ]),
    completeLegacySets: Object.freeze([
      Object.freeze(["044_job_post_review_title_search"]),
      Object.freeze(["20260818070000_job_post_review_title_search"]),
    ]),
  }),
]);

// These entries are compatibility/no-op history records and are intentionally
// removed from _prisma_migrations when the new sequence is adopted.
export const obsoleteMigrationNames = Object.freeze([
  "031_smarthire",
  "20260813061054_smarthire",
  "20260814131732_smarthire",
]);

// Known checksums from timestamp-generated and pre-normalized histories. The
// reconciliation script accepts the canonical source checksum as well.
export const migrationChecksumAliases = Object.freeze({
  "031_smarthire": Object.freeze([
    "cac3eefe7032b87260d5c7ce6ca0d76c4d39cc616903c9719da2f441356d1fde",
    "69c9f9bad3f1bd228d639fd8143cfec7c153c2114c55584a5408913e0ef0a4f7",
  ]),
  "20260813061054_smarthire": Object.freeze([
    "69c9f9bad3f1bd228d639fd8143cfec7c153c2114c55584a5408913e0ef0a4f7",
  ]),
  "20260814131732_smarthire": Object.freeze([
    "37bfd88f3db24b583690dfff1df684d1be77477665f105d21c111abc3dfd1e43",
  ]),
  "20260816050940_smarthire": Object.freeze([
    "2391f9c22115224c30dde82c4ffe885f34d920ff627ac4ffa8352f89d35127b2",
    "04f25c85ab8179b94b9006f6779099d535c5db7295df042813729cdc5aca5a40",
  ]),
  "20260817141725_smarthire": Object.freeze([
    "2ef04bdd6d92a6e64ed8c7f30914f08a017522b9ff31a1ecba1092ea79de36b5",
  ]),
  "20260818051344_smarthire": Object.freeze([
    "2b7555ddc2732741b4045d2089070de4468af8ad638a76cd2c5c5ccfe6e684df",
  ]),
});
