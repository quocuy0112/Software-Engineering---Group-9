import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { serverEnvironment } from "@/lib/env/runtime";

export type RateLimitDecision = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };

export class PrismaRateLimitRepository {
  subjectDigest(subject: string): string {
    return createHmac("sha256", serverEnvironment.TOKEN_SECRET).update(subject.normalize("NFKC")).digest("hex");
  }

  async consume(input: { scope: string; subject: string; limit: number; windowSeconds: number; now?: Date }): Promise<RateLimitDecision> {
    const now = input.now ?? new Date();
    const windowMs = input.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const subjectDigest = this.subjectDigest(input.subject);
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitBucket" ("scope", "subjectDigest", "windowStart", "count", "updatedAt")
      VALUES (${input.scope}, ${subjectDigest}, ${windowStart}, 1, ${now})
      ON CONFLICT ("scope", "subjectDigest", "windowStart")
      DO UPDATE SET "count" = "RateLimitBucket"."count" + 1, "updatedAt" = ${now}
      RETURNING "count"
    `;
    const count = rows[0]?.count ?? input.limit + 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
    return { allowed: count <= input.limit, limit: input.limit, remaining: Math.max(0, input.limit - count), retryAfterSeconds: count <= input.limit ? 0 : retryAfterSeconds };
  }
}
