import "server-only";
import { auth } from "@/backend/auth/cookies/config";

/** Minimal credential boundary; hashing and account persistence remain Better Auth-owned. */
export class BetterAuthPasswordGateway {
  private async credential(userId: string) {
    const context = await auth.$context;
    const credential = (
      await context.internalAdapter.findAccounts(userId)
    ).find(
      (account) =>
        account.providerId === "credential" && Boolean(account.password),
    );
    if (!credential?.password) throw new Error("CREDENTIAL_NOT_FOUND");
    return { context, credential };
  }

  async classify(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{
    currentPasswordValid: boolean;
    newPasswordMatchesCurrent: boolean;
  }> {
    const { context, credential } = await this.credential(userId);
    const [currentPasswordValid, newPasswordMatchesCurrent] = await Promise.all(
      [
        context.password.verify({
          hash: credential.password!,
          password: currentPassword,
        }),
        context.password.verify({
          hash: credential.password!,
          password: newPassword,
        }),
      ],
    );
    return { currentPasswordValid, newPasswordMatchesCurrent };
  }

  async passwordEffective(userId: string, password: string): Promise<boolean> {
    const { context, credential } = await this.credential(userId);
    return context.password.verify({
      hash: credential.password!,
      password,
    });
  }

  /**
   * Converges an ambiguous retry on the already-submitted password without
   * issuing a second credential write. No password-derived value leaves Better
   * Auth or is persisted by SmartHire.
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    const { context, credential } = await this.credential(userId);
    if (
      await context.password.verify({
        hash: credential.password!,
        password: newPassword,
      })
    ) {
      return false;
    }
    try {
      const passwordHash = await context.password.hash(newPassword);
      await context.internalAdapter.updatePassword(userId, passwordHash);
      return true;
    } catch {
      throw new Error("PASSWORD_UPDATE_FAILED");
    }
  }

  async authoritativeSession(
    headers: Headers,
  ): Promise<{ userId: string; sessionId: string } | null> {
    const current = await auth.api.getSession({ headers }).catch(() => null);
    if (!current) return null;
    return {
      userId: current.user.id,
      sessionId: current.session.id,
    };
  }

  async assertAuthoritativeSession(
    headers: Headers,
    userId: string,
    initiatingSessionId: string,
  ): Promise<{ userId: string; sessionId: string }> {
    const current = await this.authoritativeSession(headers);
    if (
      !current ||
      current.userId !== userId ||
      current.sessionId !== initiatingSessionId
    ) {
      throw new Error("PASSWORD_CHANGE_SESSION_MISMATCH");
    }
    return current;
  }

  async revokeOtherSessions(
    headers: Headers,
    userId: string,
    initiatingSessionId: string,
  ): Promise<void> {
    await this.assertAuthoritativeSession(headers, userId, initiatingSessionId);
    try {
      await auth.api.revokeOtherSessions({ headers });
    } catch {
      throw new Error("PASSWORD_CHANGE_SESSION_REVOCATION_FAILED");
    }
    await this.assertAuthoritativeSession(headers, userId, initiatingSessionId);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const context = await auth.$context;
    await context.internalAdapter.deleteUserSessions(userId);
  }
}
