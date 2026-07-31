import "server-only";
import {
  accountIdentityMutationOutcomeSchema,
  accountIdentitySchema,
  accountNameMutationSchema,
  type AccountIdentity,
  type AccountIdentityMutationOutcome,
} from "@/shared/contracts/account/identity";
import { normalizeProposedEmail } from "@/shared/contracts/account/email-change";
import { PlainTextNormalizer } from "@/backend/security/plain-text/plain-text-normalizer";
import { PrismaAccountIdentityRepository } from "@/backend/repositories/account/prisma-account-identity-repository";

export function normalizeIdentityEmail(input: string) {
  return normalizeProposedEmail(input);
}

export function normalizeAccountName(
  input: string,
  normalizer = new PlainTextNormalizer(),
): { name: string; warnings: [] } {
  const normalized = normalizer.normalize(input, {
    field: "name",
    maxCodePoints: 150,
    required: true,
  });
  if (!normalized.value) throw new Error("ACCOUNT_NAME_INVALID");
  return { name: normalized.value, warnings: [] };
}

export class AccountIdentityService {
  constructor(
    private readonly repository = new PrismaAccountIdentityRepository(),
    private readonly normalizer = new PlainTextNormalizer(),
  ) {}

  async get(userId: string, now = new Date()): Promise<AccountIdentity> {
    const row = await this.repository.findOwned(userId, now);
    if (!row) throw new Error("ACCOUNT_IDENTITY_UNAVAILABLE");
    return accountIdentitySchema.parse({
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      accountState: row.state,
      createdAt: row.createdAt.toISOString(),
      pendingEmailChange: row.pendingEmailChange
        ? {
            proposedEmail: row.pendingEmailChange.proposedEmail,
            expiresAt: row.pendingEmailChange.expiresAt.toISOString(),
          }
        : null,
    });
  }

  async updateName(
    userId: string,
    input: unknown,
    now = new Date(),
  ): Promise<AccountIdentityMutationOutcome> {
    const mutation = accountNameMutationSchema.parse(input);
    const normalized = normalizeAccountName(mutation.name, this.normalizer);
    if (!(await this.repository.updateOwnedName(userId, normalized.name))) {
      throw new Error("ACCOUNT_IDENTITY_UNAVAILABLE");
    }
    return accountIdentityMutationOutcomeSchema.parse({
      identity: await this.get(userId, now),
      warnings: normalized.warnings,
      message: "Account identity saved.",
    });
  }
}
