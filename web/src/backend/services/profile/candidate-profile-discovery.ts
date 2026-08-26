import "server-only";
import { randomUUID } from "node:crypto";
import { PrismaAuditRepository } from "@/backend/repositories/audit/prisma-audit-repository";
import { PrismaProfileQueryRepository } from "@/backend/repositories/profile/prisma-profile-query-repository";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";
import { GetProfileAggregateService } from "@/backend/services/profile/get-profile-aggregate";
import { projectVisibleProfile } from "@/backend/services/profile/profile-visibility-projection";
import type { DiscoverableProfile } from "@/shared/contracts/profile-discovery";

export class ProfileDiscoveryRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("PROFILE_DISCOVERY_RATE_LIMITED");
  }
}

type DiscoveryInput = {
  actorUserId: string;
  networkSubject: string;
  targetUserId: string;
  ipPrefixDigest: string;
};

export class CandidateProfileDiscoveryService {
  constructor(
    private readonly profiles = new PrismaProfileQueryRepository(),
    private readonly aggregate = new GetProfileAggregateService(),
    private readonly rateLimits = new PrismaRateLimitRepository(),
    private readonly audit = new PrismaAuditRepository(),
  ) {}

  private async auditOutcome(input: DiscoveryInput, outcome: "returned" | "neutral" | "blocked") {
    await this.audit.append({
      occurredAt: new Date(),
      actorType: "user",
      actorUserId: input.actorUserId,
      actorSessionId: null,
      action: `profile.discovery_${outcome}`,
      targetType: "profile_discovery",
      targetId: this.rateLimits.subjectDigest(input.targetUserId),
      result: outcome === "returned" ? "SUCCESS" : "DENIED",
      correlationId: randomUUID(),
      ipPrefixDigest: input.ipPrefixDigest,
      context: { outcome },
    });
  }

  private async admit(input: DiscoveryInput) {
    const policies = [
      [rateLimitPolicies.profileDiscoveryAccount, input.actorUserId],
      [rateLimitPolicies.profileDiscoveryNetwork, input.networkSubject],
    ] as const;
    for (const [policy, subject] of policies) {
      const blockedUntil = await this.rateLimits.blocked({ scope: policy.scope, subject });
      if (blockedUntil) {
        throw new ProfileDiscoveryRateLimitError(
          Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)),
        );
      }
      const decision = await this.rateLimits.consume({ ...policy, subject });
      if (!decision.allowed) throw new ProfileDiscoveryRateLimitError(decision.retryAfterSeconds);
    }
  }

  private async recordUnsuccessful(input: DiscoveryInput) {
    const policies = [
      [rateLimitPolicies.profileDiscoveryFailuresAccount, input.actorUserId],
      [rateLimitPolicies.profileDiscoveryFailuresNetwork, input.networkSubject],
    ] as const;
    for (const [policy, subject] of policies) {
      const decision = await this.rateLimits.consume({ ...policy, subject });
      if (!decision.allowed) {
        await this.rateLimits.block({ scope: policy.scope, subject, seconds: 15 * 60 });
        // Also block the admission scope used by the next request.
        const admissionScope = policy === rateLimitPolicies.profileDiscoveryFailuresAccount
          ? rateLimitPolicies.profileDiscoveryAccount.scope
          : rateLimitPolicies.profileDiscoveryNetwork.scope;
        await this.rateLimits.block({ scope: admissionScope, subject, seconds: 15 * 60 });
      }
    }
  }

  async execute(input: DiscoveryInput): Promise<DiscoverableProfile | null> {
    try {
      await this.admit(input);
    } catch (error) {
      if (error instanceof ProfileDiscoveryRateLimitError) {
        await this.auditOutcome(input, "blocked");
      }
      throw error;
    }
    if (input.targetUserId === input.actorUserId) {
      await this.auditOutcome(input, "neutral");
      return null;
    }
    const row = await this.profiles.findDiscoverable(input.targetUserId);
    if (!row) {
      await this.recordUnsuccessful(input);
      await this.auditOutcome(input, "neutral");
      return null;
    }
    const profile = await this.aggregate.execute(input.targetUserId);
    const projected = projectVisibleProfile({
      userId: input.targetUserId,
      displayName: row.candidate.user.name,
      image: row.candidate.user.image,
      profile,
      audience: "candidate",
    });
    await this.auditOutcome(input, "returned");
    return projected;
  }
}
