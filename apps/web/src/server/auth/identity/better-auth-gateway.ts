import "server-only";
import { auth } from "@/server/auth/config";
import { hashPassword } from "better-auth/crypto";
import type { AuthGateway, SessionSummary } from "./auth-gateway";

export class BetterAuthGateway implements AuthGateway {
  async preparePasswordForCredential(password: string) {
    return hashPassword(password);
  }
  async getSession(headers: Headers) {
    const result = await auth.api.getSession({ headers });
    return result ? { userId: result.user.id, sessionId: result.session.id } : null;
  }

  async listSessions(headers: Headers): Promise<SessionSummary[]> {
    const current = await auth.api.getSession({ headers });
    const sessions = await auth.api.listSessions({ headers });
    return sessions.map((session) => ({ id: session.id, userId: session.userId, expiresAt: session.expiresAt, current: session.id === current?.session.id }));
  }

  async revokeSession(headers: Headers, token: string) {
    await auth.api.revokeSession({ headers, body: { token } });
  }

  async revokeAllSessions(headers: Headers) {
    await auth.api.revokeSessions({ headers });
  }

  async signOut(headers: Headers) {
    await auth.api.signOut({ headers });
  }

  async enableTotp(headers: Headers, password: string) {
    return auth.api.enableTwoFactor({ headers, body: { password } });
  }

  async verifyTotp(headers: Headers, code: string) {
    await auth.api.verifyTOTP({ headers, body: { code } });
  }

  async verifyBackupCode(headers: Headers, code: string) {
    await auth.api.verifyBackupCode({ headers, body: { code } });
  }

  async regenerateBackupCodes(headers: Headers, password: string) {
    const result = await auth.api.generateBackupCodes({ headers, body: { password } });
    return result.backupCodes;
  }
}
