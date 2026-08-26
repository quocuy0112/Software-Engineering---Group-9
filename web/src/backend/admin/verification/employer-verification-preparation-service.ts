import "server-only";
import { createHash } from "node:crypto";
import { requireSession } from "@/backend/auth/session/require-session";
import type { EmployerVerificationPreparationRepository } from "./employer-verification-preparation-repository";
import { registryLookupConfirmsBusiness } from "@/shared/contracts/employer-verification/business-verification-responses";
import { PrismaEmployerVerificationPreparationRepository } from "@/backend/repositories/admin/prisma-employer-verification-preparation-repository";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { ProtectedOutboxRecipient } from "@/backend/security/protected-recipient/protected-outbox-recipient";
import { TokenProtector } from "@/backend/security/security-token/security-tokens";
import { selectedBusinessRegistryProvider } from "@/backend/business-registry/business-registry-provider";
import {
  companyEmailChallengeSchema,
  companyEmailConfirmationSchema,
  preparationPatchSchema,
  registryLookupSchema,
  splitCompanyIdentity,
} from "@/shared/contracts/employer-verification/business-verification";
import type { EmployerVerificationPreparationResponse } from "@/shared/contracts/employer-verification/business-verification-responses";
import { businessVerificationConfig } from "./business-verification-config";
import {
  digestCompanyEmailValue,
  maskCompanyEmail,
} from "./company-email-verification";

const rateLimits = new PrismaRateLimitRepository();
const tokens = new TokenProtector();
const recipients = new ProtectedOutboxRecipient();
const preparationRepository =
  new PrismaEmployerVerificationPreparationRepository();

async function activeCandidate(
  request: Request,
  now: Date,
  repository: EmployerVerificationPreparationRepository,
) {
  const session = await requireSession(request.headers, now);
  if (!session) throw new Error("UNAUTHORIZED");
  if (!(await repository.isActiveUser(session.userId)))
    throw new Error("UNAUTHORIZED");
  return session.userId;
}

function canonicalDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class EmployerVerificationPreparationService {
  constructor(
    private readonly repository: EmployerVerificationPreparationRepository = preparationRepository,
  ) {}

  async get(request: Request) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    return this.project(userId, now);
  }

  async lookup(request: Request, raw: unknown) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    const input = registryLookupSchema.parse(raw);
    await this.admit("business-registry-account", userId, 10, 15 * 60, now);
    await this.admit(
      "business-registry-identifier",
      input.taxIdentifier,
      30,
      15 * 60,
      now,
    );
    const reusable = await this.repository.hasReusableLookup({
      userId,
      taxIdentifier: input.taxIdentifier,
      checkedAfter: new Date(
        now.getTime() - businessVerificationConfig.lookupCacheLifetimeMs,
      ),
      now,
    });
    if (reusable) return this.project(userId, now);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      businessVerificationConfig.providerTimeoutMs,
    );
    const result = await selectedBusinessRegistryProvider()
      .lookup(input.taxIdentifier, controller.signal)
      .finally(() => clearTimeout(timeout));
    const expiresAt = new Date(
      now.getTime() + businessVerificationConfig.lookupLifetimeMs,
    );
    const deleteAfter = new Date(expiresAt.getTime() + 2 * 24 * 60 * 60_000);
    await this.repository.replaceLookup({
      userId,
      taxIdentifier: input.taxIdentifier,
      result,
      responseDigest: canonicalDigest(result),
      now,
      expiresAt,
      snapshotDeleteAfter: deleteAfter,
      preparationExpiresAt: new Date(
        now.getTime() + businessVerificationConfig.preparationLifetimeMs,
      ),
      sensitiveDeleteAfter: new Date(
        now.getTime() + businessVerificationConfig.sensitiveScrubDelayMs,
      ),
    });
    return this.project(userId, now);
  }

  async patch(request: Request, raw: unknown) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    const input = preparationPatchSchema.parse(raw);
    const preparation = await this.repository.findPreparationForChallenge({
      userId,
      version: input.version,
      now,
    });
    if (
      preparation?.id !== input.preparationId ||
      !preparation.lookupSnapshot ||
      !registryLookupConfirmsBusiness(preparation.lookupSnapshot.outcome)
    ) {
      throw new Error("LOOKUP_REQUIRED");
    }
    const changed = await this.repository.updateDraft({
      userId,
      preparationId: input.preparationId,
      version: input.version,
      changes: input.changes,
      now,
      expiresAt: new Date(
        now.getTime() + businessVerificationConfig.preparationLifetimeMs,
      ),
    });
    if (!changed) throw new Error("STALE_CONFLICT");
    return this.project(userId, now);
  }

  async issueEmailChallenge(request: Request, raw: unknown) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    const input = companyEmailChallengeSchema.parse(raw);
    const preparation = await this.repository.findPreparationForChallenge({
      userId,
      version: input.preparationVersion,
      now,
    });
    if (
      !preparation?.lookupSnapshot ||
      preparation.lookupSnapshot.expiresAt <= now ||
      !registryLookupConfirmsBusiness(preparation.lookupSnapshot.outcome)
    ) {
      throw new Error("LOOKUP_REQUIRED");
    }
    await this.admit("company-email-account", userId, 5, 60 * 60, now);
    await this.admit(
      "company-email-binding",
      `${userId}:${input.email}`,
      5,
      60 * 60,
      now,
    );
    const token = tokens.generate();
    const tokenDigest = tokens.digest(token);
    const emailDigest = digestCompanyEmailValue(input.email);
    const expiresAt = new Date(
      Math.min(
        preparation.lookupSnapshot.expiresAt.getTime(),
        now.getTime() + businessVerificationConfig.challengeLifetimeMs,
      ),
    );
    const challenge = await this.repository.issueEmailChallenge({
      userId,
      snapshotId: preparation.lookupSnapshot.id,
      taxIdentifier: preparation.lookupSnapshot.normalizedTaxIdentifier,
      normalizedEmail: input.email,
      emailDigest,
      tokenDigest,
      protectedToken: tokens.seal(token),
      recipientCiphertext: recipients.seal(
        input.email,
        "company-email-verification.v1",
      ),
      now,
      expiresAt,
      sensitiveDeleteAfter: new Date(
        now.getTime() + businessVerificationConfig.sensitiveScrubDelayMs,
      ),
      metadataDeleteAfter: new Date(
        now.getTime() + businessVerificationConfig.metadataRetentionMs,
      ),
    });
    return {
      status: "PENDING" as const,
      expiresAt: challenge.expiresAt.toISOString(),
      maskedEmail: maskCompanyEmail(input.email),
    };
  }

  async confirmEmail(request: Request, raw: unknown) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    const { token } = companyEmailConfirmationSchema.parse(raw);
    const tokenDigest = tokens.digest(token);
    const challenge = await this.repository.findPendingEmailChallenge({
      userId,
      tokenDigest,
      now,
    });
    if (!challenge?.normalizedEmail) throw new Error("CHALLENGE_UNAVAILABLE");
    const changed = await this.repository.verifyEmailChallenge({
      challengeId: challenge.id,
      tokenDigest,
      now,
    });
    if (!changed) throw new Error("CHALLENGE_UNAVAILABLE");
    return {
      status: "VERIFIED" as const,
      verifiedAt: now.toISOString(),
      expiresAt: challenge.expiresAt.toISOString(),
      maskedEmail: maskCompanyEmail(challenge.normalizedEmail),
    };
  }

  async reset(request: Request) {
    const now = new Date();
    const userId = await activeCandidate(request, now, this.repository);
    await this.repository.invalidateCurrentPreparation({
      userId,
      now,
      sensitiveDeleteAfter: new Date(
        now.getTime() + businessVerificationConfig.sensitiveScrubDelayMs,
      ),
    });
    return this.project(userId, now);
  }

  private async admit(
    scope: string,
    subject: string,
    limit: number,
    windowSeconds: number,
    now: Date,
  ) {
    const decision = await rateLimits.consume({
      scope,
      subject,
      limit,
      windowSeconds,
      now,
    });
    if (!decision.allowed) {
      throw Object.assign(new Error("RATE_LIMITED"), {
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    }
  }

  private async project(
    userId: string,
    now: Date,
  ): Promise<EmployerVerificationPreparationResponse> {
    const preparation = await this.repository.findCurrentPreparation(
      userId,
      now,
    );
    if (!preparation) {
      return {
        data: {
          preparationId: null,
          version: 0,
          lookup: null,
          email: { status: "NONE" },
          draft: {},
        },
      };
    }
    const challenge = preparation.lookupSnapshotId
      ? await this.repository.findLatestEmailChallenge(
          userId,
          preparation.lookupSnapshotId,
        )
      : null;
    const snapshot = preparation.lookupSnapshot;
    const registryIdentity = snapshot
      ? splitCompanyIdentity(
          snapshot.registryLegalName ?? "",
          snapshot.registryEntityType,
        )
      : null;
    const draftIdentity = preparation.applicantLegalName
      ? splitCompanyIdentity(
          preparation.applicantLegalName,
          registryIdentity?.entityType,
        )
      : null;
    return {
      data: {
        preparationId: preparation.id,
        version: preparation.version,
        lookup: snapshot
          ? {
              snapshotId: snapshot.id,
              taxIdentifier: snapshot.normalizedTaxIdentifier,
              outcome: snapshot.outcome,
              sourceLabel:
                snapshot.providerKey === "vietqr-v2"
                  ? "VietQR"
                  : "Registry unavailable",
              checkedAt: snapshot.checkedAt.toISOString(),
              expiresAt: snapshot.expiresAt.toISOString(),
              facts: {
                legalName: registryIdentity?.name || snapshot.registryLegalName,
                registeredAddress: snapshot.registryRegisteredAddress,
                establishmentDate:
                  snapshot.registryEstablishedAt?.toISOString().slice(0, 10) ??
                  null,
                legalStatus: snapshot.registryLegalStatus,
                entityType: registryIdentity?.entityType ?? null,
              },
            }
          : null,
        email: challenge?.normalizedEmail
          ? {
              status:
                challenge.expiresAt <= now
                  ? "EXPIRED"
                  : challenge.state === "VERIFIED"
                    ? "VERIFIED"
                    : "PENDING",
              maskedEmail: maskCompanyEmail(challenge.normalizedEmail),
              verifiedAt: challenge.verifiedAt?.toISOString() ?? null,
              expiresAt: challenge.expiresAt.toISOString(),
            }
          : { status: "NONE" },
        draft: {
          applicantLegalName:
            draftIdentity?.name ?? preparation.applicantLegalName,
          applicantRegisteredAddress: preparation.applicantRegisteredAddress,
          operatingAddressDiffers: preparation.operatingAddressDiffers,
          operatingAddress: preparation.operatingAddress,
          companyPhone: preparation.companyPhoneE164,
          website: preparation.websiteOrigin,
          requestedRole: preparation.requestedRole,
          relationship: preparation.relationship,
          currentJobTitle: preparation.currentJobTitle,
          authorityExplanation: preparation.authorityExplanation,
          mismatchExplanation: preparation.mismatchExplanation,
        },
      },
    };
  }
}
