CREATE OR REPLACE FUNCTION prevent_email_outbox_envelope_mutation()
RETURNS trigger AS $$
DECLARE
  internal_relation_cleanup boolean;
BEGIN
  internal_relation_cleanup :=
    pg_trigger_depth() > 1
    AND NEW."kind" IS NOT DISTINCT FROM OLD."kind"
    AND NEW."recipientRef" IS NOT DISTINCT FROM OLD."recipientRef"
    AND NEW."recipientCiphertext" IS NOT DISTINCT FROM OLD."recipientCiphertext"
    AND NEW."recipientPurpose" IS NOT DISTINCT FROM OLD."recipientPurpose"
    AND NEW."templateVersion" IS NOT DISTINCT FROM OLD."templateVersion"
    AND NEW."payloadRef" IS NOT DISTINCT FROM OLD."payloadRef"
    AND NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey"
    AND (NEW."userId" IS NOT DISTINCT FROM OLD."userId" OR NEW."userId" IS NULL)
    AND (NEW."securityTokenId" IS NOT DISTINCT FROM OLD."securityTokenId" OR NEW."securityTokenId" IS NULL)
    AND (NEW."verificationRequestId" IS NOT DISTINCT FROM OLD."verificationRequestId" OR NEW."verificationRequestId" IS NULL)
    AND (NEW."supportConversationId" IS NOT DISTINCT FROM OLD."supportConversationId" OR NEW."supportConversationId" IS NULL)
    AND (NEW."professionalConnectionProposalId" IS NOT DISTINCT FROM OLD."professionalConnectionProposalId" OR NEW."professionalConnectionProposalId" IS NULL)
    AND (NEW."professionalConnectionId" IS NOT DISTINCT FROM OLD."professionalConnectionId" OR NEW."professionalConnectionId" IS NULL)
    AND (NEW."companyEmailChallengeId" IS NOT DISTINCT FROM OLD."companyEmailChallengeId" OR NEW."companyEmailChallengeId" IS NULL);

  IF internal_relation_cleanup THEN
    RETURN NEW;
  END IF;

  IF (
    NEW."kind",
    NEW."userId",
    NEW."securityTokenId",
    NEW."verificationRequestId",
    NEW."supportConversationId",
    NEW."professionalConnectionProposalId",
    NEW."professionalConnectionId",
    NEW."companyEmailChallengeId",
    NEW."recipientRef",
    NEW."recipientCiphertext",
    NEW."recipientPurpose",
    NEW."templateVersion",
    NEW."payloadRef",
    NEW."idempotencyKey"
  ) IS DISTINCT FROM (
    OLD."kind",
    OLD."userId",
    OLD."securityTokenId",
    OLD."verificationRequestId",
    OLD."supportConversationId",
    OLD."professionalConnectionProposalId",
    OLD."professionalConnectionId",
    OLD."companyEmailChallengeId",
    OLD."recipientRef",
    OLD."recipientCiphertext",
    OLD."recipientPurpose",
    OLD."templateVersion",
    OLD."payloadRef",
    OLD."idempotencyKey"
  ) THEN
    RAISE EXCEPTION 'EmailOutbox delivery envelope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
