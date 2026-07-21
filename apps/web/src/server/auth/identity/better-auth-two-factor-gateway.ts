import "server-only";
import { auth } from "@/server/auth/config";

/**
 * The only enrollment data the service layer is allowed to observe.
 * Deliberately excludes database rows, encrypted persistence values,
 * Better Auth provider internals, and raw storage models.
 */
export type TwoFactorEnrollmentStart = {
  /** Better Auth-generated otpauth:// URI (secret-bearing; never logged or persisted). */
  otpauthUri: string;
  /** The one-time backup codes generated alongside the pending secret. */
  backupCodes: string[];
};

/**
 * Minimal typed boundary over Better Auth's two-factor plugin. Better Auth
 * remains the exclusive owner of enrollment state, the TOTP secret, backup
 * codes, verification, and enablement. This gateway adds no parallel
 * repository and exposes only what the enrollment service needs.
 */
export interface TwoFactorGateway {
  /**
   * Starts enrollment: Better Auth generates and stores the (encrypted) pending
   * secret plus backup codes, and returns the otpauth URI. The account is not
   * yet verified — `skipVerificationOnEnable` is false in config.
   */
  startEnrollment(headers: Headers, password: string): Promise<TwoFactorEnrollmentStart>;
  /**
   * Verifies the user's first six-digit TOTP code, which flips the stored
   * TwoFactor row to verified and enables 2FA on the account.
   */
  verifyInitialTotp(headers: Headers, code: string): Promise<boolean>;
  /**
   * Reveals the backup codes Better Auth generated and stored (encrypted) at
   * enrollment start, decrypted through Better Auth. Called only after the
   * initial TOTP verification succeeds, so the codes surface exactly once.
   */
  revealBackupCodes(headers: Headers, userId: string): Promise<string[]>;
}

export class BetterAuthTwoFactorGateway implements TwoFactorGateway {
  async startEnrollment(headers: Headers, password: string): Promise<TwoFactorEnrollmentStart> {
    const result = await auth.api.enableTwoFactor({ headers, body: { password } });
    return { otpauthUri: result.totpURI, backupCodes: result.backupCodes };
  }

  async verifyInitialTotp(headers: Headers, code: string): Promise<boolean> {
    try {
      await auth.api.verifyTOTP({ headers, body: { code } });
      return true;
    } catch {
      return false;
    }
  }

  async revealBackupCodes(_headers: Headers, userId: string): Promise<string[]> {
    const result = await auth.api.viewBackupCodes({ body: { userId } });
    return result.backupCodes;
  }
}
