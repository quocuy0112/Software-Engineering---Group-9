import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/backend/database/prisma";
import { serverEnvironment } from "@/backend/env/runtime";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export class PrismaRateLimitRepository {
  subjectDigest(subject: string): string {
    return createHmac("sha256", serverEnvironment.TOKEN_SECRET)
      .update(subject.normalize("NFKC"))
      .digest("hex");
  }

  async consume(input: {
    scope: string;
    subject: string;
    limit: number;
    windowSeconds: number;
    now?: Date;
  }): Promise<RateLimitDecision> {
    const now = input.now ?? new Date();
    const windowMs = input.windowSeconds * 1000;
    const windowStart = new Date(
      Math.floor(now.getTime() / windowMs) * windowMs,
    );
    const subjectDigest = this.subjectDigest(input.subject);
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("scope", "subjectDigest", "windowStart", "count", "updatedAt")
      VALUES (${input.scope}, ${subjectDigest}, ${windowStart}, 1, ${now})
      ON CONFLICT ("scope", "subjectDigest", "windowStart")
      DO UPDATE SET "count" = "RateLimitBucket"."count" + 1, "updatedAt" = ${now}
      RETURNING "count"
    `;
    const count = rows[0]?.count ?? input.limit + 1;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000),
    );
    return {
      allowed: count <= input.limit,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: count <= input.limit ? 0 : retryAfterSeconds,
    };
  }

  async blocked(input: { scope: string; subject: string; now?: Date }) {
    const now = input.now ?? new Date();
    const record = await prisma.rateLimitBucket.findUnique({
      where: {
        scope_subjectDigest_windowStart: {
          scope: `${input.scope}:block`,
          subjectDigest: this.subjectDigest(input.subject),
          windowStart: new Date(0),
        },
      },
      select: { blockedUntil: true },
    });
    const blockedUntil = record?.blockedUntil;
    return blockedUntil && blockedUntil > now ? blockedUntil : null;
  }

  async block(input: {
    scope: string;
    subject: string;
    seconds: number;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    const blockedUntil = new Date(now.getTime() + input.seconds * 1000);
    await prisma.rateLimitBucket.upsert({
      where: {
        scope_subjectDigest_windowStart: {
          scope: `${input.scope}:block`,
          subjectDigest: this.subjectDigest(input.subject),
          windowStart: new Date(0),
        },
      },
      create: {
        scope: `${input.scope}:block`,
        subjectDigest: this.subjectDigest(input.subject),
        windowStart: new Date(0),
        count: 0,
        blockedUntil,
      },
      update: { blockedUntil },
    });
    return blockedUntil;
  }
}
