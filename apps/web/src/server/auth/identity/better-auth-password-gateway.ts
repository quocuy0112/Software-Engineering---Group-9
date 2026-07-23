import "server-only";
import { auth } from "@/server/auth/config";

/** Minimal credential boundary; hashing and account persistence remain Better Auth-owned. */
export class BetterAuthPasswordGateway {
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    const context = await auth.$context;
    const passwordHash = await context.password.hash(newPassword);
    await context.internalAdapter.updatePassword(userId, passwordHash);
    return true;
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const context = await auth.$context;
    await context.internalAdapter.deleteSessions(userId);
  }

  /**
   * Password-reset possession is the renewed account proof for this flow.
   * Clear Better Auth's authoritative factor state before the account can
   * authenticate again, including the encrypted secret and backup codes.
   */
  async disableTwoFactorForPasswordReset(userId: string): Promise<void> {
    const context = await auth.$context;
    await context.internalAdapter.updateUser(userId, { twoFactorEnabled: false });
    await context.adapter.deleteMany({
      model: "TwoFactor",
      where: [{ field: "userId", value: userId }],
    });
  }
}
