-- Forward-fix the Feature 002 envelope trigger so the existing retention-safe
-- ON DELETE SET NULL relations can detach deleted users and security tokens.
-- A relation may only move from a non-null value to null; retargeting an
-- existing immutable delivery intent remains forbidden.
CREATE OR REPLACE FUNCTION prevent_email_outbox_envelope_mutation()
RETURNS trigger AS $$
BEGIN
  IF (
    NEW."kind",
    NEW."recipientRef",
    NEW."recipientCiphertext",
    NEW."recipientPurpose",
    NEW."templateVersion",
    NEW."payloadRef",
    NEW."idempotencyKey"
  ) IS DISTINCT FROM (
    OLD."kind",
    OLD."recipientRef",
    OLD."recipientCiphertext",
    OLD."recipientPurpose",
    OLD."templateVersion",
    OLD."payloadRef",
    OLD."idempotencyKey"
  ) OR (
    NEW."userId" IS DISTINCT FROM OLD."userId" AND
    NEW."userId" IS NOT NULL
  ) OR (
    NEW."securityTokenId" IS DISTINCT FROM OLD."securityTokenId" AND
    NEW."securityTokenId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'EmailOutbox delivery envelope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
