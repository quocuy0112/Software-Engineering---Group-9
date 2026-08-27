-- Notify active company owners when a candidate submits a team application.
ALTER TYPE "InAppNotificationKind"
ADD VALUE IF NOT EXISTS 'TEAM_APPLICATION_RECEIVED';
