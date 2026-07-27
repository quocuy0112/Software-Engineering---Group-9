import "server-only";
import { type AuthenticationAuditEvent } from "@/lib/audit/events";
import {
  rateLimitPolicies,
  safeRetryMetadata,
} from "@/lib/rate-limit/policies";
import type { PrismaAuditRepository } from "@/server/repositories/audit/prisma-audit-repository";
import type { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";

const compromisedPasswords = new Set([
  "password",
  "password123",
  "123456789012",
  "qwerty123456",
  "letmein123456",
  "admin12345678",
  "smarthire1234",
]);

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}

export type PasswordPolicyResult =
  | { accepted: true }
  | {
      accepted: false;
      code: "PASSWORD_POLICY" | "PASSWORD_COMPROMISED" | "RATE_LIMITED";
      message: string;
      retryAfterSeconds?: number;
    };

export class PasswordPolicy {
  constructor(
    private readonly limiter?: PrismaRateLimitRepository,
    private readonly audit?: PrismaAuditRepository,
  ) {}

  async evaluate(
    password: string,
    context?: { subject: string; correlationId: string; now?: Date },
  ): Promise<PasswordPolicyResult> {
    if (context && this.limiter) {
      const policy = rateLimitPolicies.registration;
      const decision = await this.limiter.consume({
        ...policy,
        subject: context.subject,
        now: context.now,
      });
      if (!decision.allowed) {
        await this.appendAudit("rate_limit.denied", "DENIED", context);
        return {
          accepted: false,
          code: "RATE_LIMITED",
          ...safeRetryMetadata(decision),
        };
      }
    }
    const length = [...password].length;
    if (length < 12 || length > 128 || hasControlCharacter(password)) {
      if (context)
        await this.appendAudit("password.policy_rejected", "DENIED", context);
      return {
        accepted: false,
        code: "PASSWORD_POLICY",
        message: "Use 12–128 characters without control characters.",
      };
    }
    if (
      compromisedPasswords.has(
        password.normalize("NFKC").toLocaleLowerCase("en-US"),
      )
    ) {
      if (context)
        await this.appendAudit(
          "password.compromised_rejected",
          "DENIED",
          context,
        );
      return {
        accepted: false,
        code: "PASSWORD_COMPROMISED",
        message:
          "Choose a password that has not appeared in common password lists.",
      };
    }
    return { accepted: true };
  }

  mapCredentialError(): {
    code: "CREDENTIAL_OPERATION_FAILED";
    message: string;
  } {
    return {
      code: "CREDENTIAL_OPERATION_FAILED",
      message: "The request could not be completed.",
    };
  }

  private async appendAudit(
    action: AuthenticationAuditEvent["action"],
    result: AuthenticationAuditEvent["result"],
    context: { correlationId: string },
  ) {
    await this.audit?.append({
      occurredAt: new Date(),
      actorType: "anonymous",
      action,
      targetType: "request",
      result,
      correlationId: context.correlationId,
      context: {},
    });
  }
}
