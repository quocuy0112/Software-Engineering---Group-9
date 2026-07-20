import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";

describe("PostgreSQL rate limiter", () => {
  it("increments atomically across concurrent callers and returns safe retry metadata", async () => {
    const repository = new PrismaRateLimitRepository();
    const subject = randomUUID();
    const results = await Promise.all(Array.from({ length: 8 }, () => repository.consume({ scope: "test", subject, limit: 5, windowSeconds: 60 })));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
    expect(results.every((result) => !JSON.stringify(result).includes(subject))).toBe(true);
  });
});
