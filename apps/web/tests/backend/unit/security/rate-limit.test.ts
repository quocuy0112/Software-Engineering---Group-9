import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";

describe("PostgreSQL rate limiter", () => {
  it("increments atomically across concurrent callers and returns safe retry metadata", async () => {
    const repository = new PrismaRateLimitRepository();
    const subject = randomUUID();
    const results = await Promise.all(Array.from({ length: 8 }, () => repository.consume({ scope: "test", subject, limit: 5, windowSeconds: 60 })));
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
    expect(results.every((result) => !JSON.stringify(result).includes(subject))).toBe(true);
  });
  it("allows exactly the configured boundary and never returns the raw privacy subject", async () => {
    const repository=new PrismaRateLimitRepository(); const subject=`person:${randomUUID()}`;
    const first=await repository.consume({scope:"boundary",subject,limit:1,windowSeconds:60});
    const second=await repository.consume({scope:"boundary",subject,limit:1,windowSeconds:60});
    expect(first.allowed).toBe(true); expect(second.allowed).toBe(false); expect(JSON.stringify([first,second])).not.toContain(subject);
  });
});
