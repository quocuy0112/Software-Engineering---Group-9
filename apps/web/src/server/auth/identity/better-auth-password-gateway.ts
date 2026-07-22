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
}
