import "server-only";
import { auth } from "@/backend/auth/cookies/config";

/** Minimal credential boundary; hashing and account persistence remain Better Auth-owned. */
export class BetterAuthPasswordGateway {
  /**
   * Converges an ambiguous retry on the already-submitted password without
   * issuing a second credential write. No password-derived value leaves Better
   * Auth or is persisted by SmartHire.
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    const context = await auth.$context;
    const credential = (await context.internalAdapter.findAccounts(userId)).find(
      (account) => account.providerId === "credential" && account.password,
    );
    if (!credential?.password) throw new Error("CREDENTIAL_NOT_FOUND");
    if (
      await context.password.verify({
        hash: credential.password,
        password: newPassword,
      })
    ) {
      return false;
    }
    const passwordHash = await context.password.hash(newPassword);
    await context.internalAdapter.updatePassword(userId, passwordHash);
    return true;
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const context = await auth.$context;
    await context.internalAdapter.deleteUserSessions(userId);
  }
}
