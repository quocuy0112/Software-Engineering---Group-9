ALTER TABLE "EmailOutbox"
  DROP CONSTRAINT "email_outbox_protected_recipient_pair";

ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "email_outbox_protected_recipient_pair"
  CHECK (
    ("recipientCiphertext" IS NULL AND "recipientPurpose" IS NULL) OR
    (
      "recipientCiphertext" IS NOT NULL AND
      "recipientPurpose" IN (
        'email-change-verification.v1',
        'email-change-old-address.v1',
        'password-change-notice.v1',
        'company-email-verification.v1'
      )
    )
  );
