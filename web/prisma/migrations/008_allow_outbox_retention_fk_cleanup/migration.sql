-- Preserve the immutable delivery envelope while allowing the schema's
-- reviewed ON DELETE SET NULL retention actions for legacy owner/token links.
-- Recipient snapshots and every delivery-defining field remain immutable.
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
    NEW."userId" IS DISTINCT FROM OLD."userId"
    AND NOT (OLD."userId" IS NOT NULL AND NEW."userId" IS NULL)
  ) OR (
    NEW."securityTokenId" IS DISTINCT FROM OLD."securityTokenId"
    AND NOT (
      OLD."securityTokenId" IS NOT NULL
      AND NEW."securityTokenId" IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'EmailOutbox delivery envelope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
