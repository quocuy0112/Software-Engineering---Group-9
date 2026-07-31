-- Better Auth 1.6.25 persists account-bound TOTP failure state.
ALTER TABLE "twoFactor"
ADD COLUMN "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);
