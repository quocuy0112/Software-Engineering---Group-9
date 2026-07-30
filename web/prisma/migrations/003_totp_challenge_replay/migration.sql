ALTER TABLE "AuthenticationChallenge" ADD COLUMN "verifiedTotpStep" BIGINT;
CREATE INDEX "AuthenticationChallenge_userId_verifiedTotpStep_idx"
ON "AuthenticationChallenge"("userId", "verifiedTotpStep");
