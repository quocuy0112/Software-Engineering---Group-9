export type SessionSummary = {
  id: string;
  userId: string;
  expiresAt: Date;
  current: boolean;
};

export interface AuthGateway {
  getSession(headers: Headers): Promise<{ userId: string; sessionId: string } | null>;
  listSessions(headers: Headers): Promise<SessionSummary[]>;
  revokeSession(headers: Headers, token: string): Promise<void>;
  revokeAllSessions(headers: Headers): Promise<void>;
  signOut(headers: Headers): Promise<void>;
  enableTotp(headers: Headers, password: string): Promise<{ totpURI: string; backupCodes: string[] }>;
  verifyTotp(headers: Headers, code: string): Promise<void>;
  verifyBackupCode(headers: Headers, code: string): Promise<void>;
  regenerateBackupCodes(headers: Headers, password: string): Promise<string[]>;
}
