-- Privileged account commands use an explicit monotonic concurrency token.
ALTER TABLE "user" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "user"
  ADD CONSTRAINT "UserAccount_admin_version_positive" CHECK ("version" > 0);
