import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/backend/database/prisma";
import { PrismaRateLimitRepository } from "@/backend/repositories/rate-limit/prisma-rate-limit-repository";
import { POST } from "@/app/api/identity/password/forgot/route";

const activeUserId = randomUUID();
const activeEmail = `forgot-active-${randomUUID()}@example.test`;
const unknownEmail = `forgot-unknown-${randomUUID()}@example.test`;
const throttledEmail = `forgot-throttled-${randomUUID()}@example.test`;
const limiter = new PrismaRateLimitRepository();
const subjectDigests = [activeEmail, unknownEmail, throttledEmail].map((email) =>
  limiter.subjectDigest(`anonymous:${email}`),
);

function request(body: unknown) {
  return new Request("http://localhost:3001/api/identity/password/forgot", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3001",
      "sec-fetch-site": "same-origin",
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await prisma.userAccount.create({
    data: {
      id: activeUserId,
      name: "Forgot Password User",
      email: activeEmail,
      normalizedEmail: activeEmail,
      emailVerified: true,
      state: "ACTIVE",
    },
  });
});

afterAll(async () => {
  await prisma.emailOutbox.deleteMany({ where: { userId: activeUserId } });
  await prisma.userAccount.deleteMany({ where: { id: activeUserId } });
  await prisma.rateLimitBucket.deleteMany({
    where: { scope: "password-reset", subjectDigest: { in: subjectDigests } },
  });
  await prisma.$disconnect();
});

describe("forgot-password route", () => {
  it("returns distinct errors for malformed and unknown emails", async () => {
    const malformed = await POST(request({ email: "invalid" }));
    const unknown = await POST(request({ email: unknownEmail }));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      message: "Enter a valid email address.",
    });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({
      message: "No active account was found for this email.",
    });
    expect(unknown.headers.get("cache-control")).toContain("no-store");
  });

  it("queues reset instructions only for an active registered account", async () => {
    const response = await POST(request({ email: activeEmail }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      message: "Password-reset instructions will be sent to this email.",
    });
    await expect(
      prisma.emailOutbox.count({
        where: { userId: activeUserId, kind: "RESET_PASSWORD" },
      }),
    ).resolves.toBe(1);
  });

  it("returns a clear bounded throttling response", async () => {
    expect((await POST(request({ email: throttledEmail }))).status).toBe(404);
    expect((await POST(request({ email: throttledEmail }))).status).toBe(404);
    expect((await POST(request({ email: throttledEmail }))).status).toBe(404);
    const throttled = await POST(request({ email: throttledEmail }));
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await throttled.json()).toEqual({
      message: "Too many password-reset requests. Please try again later.",
    });
  });
});
