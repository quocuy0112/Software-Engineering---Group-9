import "server-only";
import { auth } from "@/server/auth/config";
import { serverEnvironment } from "@/lib/env/runtime";

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
  startEnrollment(
    headers: Headers,
    password: string,
  ): Promise<TwoFactorEnrollmentStart>;
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
  consumeBackupCode(
    headers: Headers,
    code: string,
  ): Promise<{ sessionCookie: string | null }>;
  regenerateBackupCodes(headers: Headers, password: string): Promise<string[]>;
  disableTwoFactor(headers: Headers, password: string): Promise<boolean>;
}

export class BetterAuthTwoFactorGateway implements TwoFactorGateway {
  private async request(path: string, body: unknown, headers: Headers) {
    const forwarded = new Headers(headers);
    forwarded.set("content-type", "application/json");
    forwarded.set(
      "origin",
      new URL(serverEnvironment.NEXT_PUBLIC_APP_URL).origin,
    );
    return auth.handler(
      new Request(
        new URL(`/api/auth${path}`, serverEnvironment.BETTER_AUTH_URL),
        {
          method: "POST",
          headers: forwarded,
          body: JSON.stringify(body),
        },
      ),
    );
  }
  async startEnrollment(
    headers: Headers,
    password: string,
  ): Promise<TwoFactorEnrollmentStart> {
    const result = await auth.api.enableTwoFactor({
      headers,
      body: { password },
    });
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

  async revealBackupCodes(
    _headers: Headers,
    userId: string,
  ): Promise<string[]> {
    const result = await auth.api.viewBackupCodes({ body: { userId } });
    return result.backupCodes;
  }

  async consumeBackupCode(headers: Headers, code: string) {
    const response = await this.request(
      "/two-factor/verify-backup-code",
      { code, trustDevice: false },
      headers,
    );
    const sessionCookie = response.ok
      ? (response.headers
          .getSetCookie()
          .find((value) =>
            /^(smarthire\.session|__Host-smarthire\.session)=/.test(value),
          ) ?? null)
      : null;
    return { sessionCookie };
  }

  async regenerateBackupCodes(headers: Headers, password: string) {
    const result = await auth.api.generateBackupCodes({
      headers,
      body: { password },
    });
    return result.backupCodes;
  }

  async disableTwoFactor(headers: Headers, password: string) {
    const result = await auth.api.disableTwoFactor({
      headers,
      body: { password },
    });
    return result.status === true;
  }
}
