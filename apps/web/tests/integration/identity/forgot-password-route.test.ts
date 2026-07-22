import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { POST } from "@/app/api/identity/password/forgot/route";

const email = `forgot-route-${randomUUID()}@example.test`;
const limiter = new PrismaRateLimitRepository();
const subjectDigest = limiter.subjectDigest(`anonymous:${email}`);

function request(body: unknown) {
  return new Request("http://localhost:3000/api/identity/password/forgot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

afterAll(async () => {
  await prisma.rateLimitBucket.deleteMany({ where: { scope: "password-reset", subjectDigest } });
  await prisma.$disconnect();
});

describe("forgot-password route", () => {
  it("returns one generic accepted contract for malformed and unknown emails", async () => {
    const malformed = await POST(request({ email: "invalid" }));
    const unknown = await POST(request({ email }));
    expect(malformed.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await malformed.json()).toEqual(await unknown.json());
    expect(unknown.headers.get("cache-control")).toContain("no-store");
  });

  it("returns the same safe body with bounded throttling metadata", async () => {
    expect((await POST(request({ email }))).status).toBe(202);
    expect((await POST(request({ email }))).status).toBe(202);
    const throttled = await POST(request({ email }));
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await throttled.json()).toEqual({
      message: "If the account is eligible, password-reset instructions will be sent.",
    });
  });
});
