import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/identity/register/route";
import { POST as resend } from "@/app/api/identity/verification/resend/route";
import { POST as login } from "@/app/api/identity/login/route";
import { POST as forgot } from "@/app/api/identity/password/forgot/route";
import { POST as completeTwoFactor } from "@/app/api/identity/two-factor/complete/route";
import { prisma } from "@/lib/db/prisma";
import { identityCookiePolicy } from "@/lib/security/cookies";
import { encodePreAuth } from "@/server/auth/identity/pre-auth-cookie";
import { PrismaRateLimitRepository } from "@/server/repositories/rate-limit/prisma-rate-limit-repository";
import { serverEnvironment } from "@/lib/env/runtime";
import { trustedInternalRedirect } from "@/lib/security/trusted-redirect";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repository = new PrismaRateLimitRepository();
const subjects: Array<{ scope: string; subject: string }> = [];
const origin = serverEnvironment.NEXT_PUBLIC_APP_URL;

function request(path: string, body: unknown, extra: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

async function messages(responses: Response[]) {
  return Promise.all(
    responses.map(async (response) => ({
      status: response.status,
      body: (await response.json()) as { message?: string },
    })),
  );
}

afterEach(async () => {
  for (const { scope, subject } of subjects) {
    await prisma.rateLimitBucket.deleteMany({
      where: {
        scope,
        subjectDigest: repository.subjectDigest(subject),
      },
    });
  }
  subjects.length = 0;
});

describe("workflow security throttling route wiring", () => {
  it("keeps normal reset secret-free and never disables Better Auth two-factor state", async () => {
    const [serviceSource, gatewaySource] = await Promise.all([
      readFile(
        resolve(
          process.cwd(),
          "src/server/services/identity/reset-password.ts",
        ),
        "utf8",
      ),
      readFile(
        resolve(
          process.cwd(),
          "src/server/auth/identity/better-auth-password-gateway.ts",
        ),
        "utf8",
      ),
    ]);
    const resetSources = `${serviceSource}\n${gatewaySource}`;
    expect(resetSources).not.toContain("disableTwoFactorForPasswordReset");
    expect(resetSources).not.toMatch(/model:\s*["']TwoFactor["']/);
    expect(resetSources).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(serviceSource).toContain("SESSION_REVOCATION_FAILED");
    expect(serviceSource).toContain("CHALLENGE_INVALIDATION_FAILED");
  });

  it("rejects cross-origin writes, unsafe redirects, and forwarded-header limit bypass", async () => {
    const crossOrigin = await register(
      new Request(`${origin}/api/identity/register`, {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );
    expect(crossOrigin.status).toBe(403);
    expect(trustedInternalRedirect("https://attacker.example/path", origin)).toBe("/");
    expect(trustedInternalRedirect("//attacker.example/path", origin)).toBe("/");

    const email = `forwarded-${randomUUID()}@example.test`;
    subjects.push({ scope: "registration", subject: `anonymous:${email}` });
    const responses = [];
    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await register(
          request(
            "/api/identity/register",
            {
              name: "Forwarded Attempt",
              email,
              password: "smarthire1234",
              passwordConfirmation: "smarthire1234",
            },
            { "x-forwarded-for": `203.0.113.${index + 1}` },
          ),
        ),
      );
    }
    expect(responses.at(-1)?.status).toBe(429);

    const managementSources = await Promise.all([
      "two-factor/enrollment/route.ts",
      "two-factor/backup-codes/regenerate/route.ts",
      "two-factor/disable/route.ts",
    ].map((file) => readFile(resolve(process.cwd(), "src/app/api/identity", file), "utf8")));
    expect(managementSources.join("\n")).not.toContain("x-forwarded-for");
  });
  it("throttles registration and resend without account enumeration", async () => {
    const registrationEmail = `limit-${randomUUID()}@example.test`;
    const registrationSubject = `anonymous:${registrationEmail}`;
    subjects.push({ scope: "registration", subject: registrationSubject });
    const registrationResponses: Response[] = [];
    for (let i = 0; i < 6; i += 1)
      registrationResponses.push(
        await register(
          request("/api/identity/register", {
            name: "Limit Candidate",
            email: registrationEmail,
            password: "smarthire1234",
            passwordConfirmation: "smarthire1234",
          }),
        ),
      );
    const registration = await messages(registrationResponses);
    expect(registration.slice(0, 5).every(({ status }) => status === 400)).toBe(
      true,
    );
    expect(registration[5]?.status).toBe(429);
    expect(JSON.stringify(registration[5]?.body)).not.toContain(
      registrationEmail,
    );

    const resendEmail = `resend-${randomUUID()}@example.test`;
    const resendSubject = `anonymous:${resendEmail}`;
    subjects.push({ scope: "verification-resend", subject: resendSubject });
    const resendResponses: Response[] = [];
    for (let i = 0; i < 4; i += 1)
      resendResponses.push(
        await resend(
          request("/api/identity/verification/resend", {
            email: resendEmail,
          }),
        ),
      );
    const resendResults = await messages(resendResponses);
    expect(resendResults.slice(0, 3).every(({ status }) => status === 202)).toBe(
      true,
    );
    expect(resendResults[3]?.status).toBe(429);
    expect(JSON.stringify(resendResults[3]?.body)).not.toContain(resendEmail);
  });

  it("applies account login, recovery, and challenge limits generically", async () => {
    const email = `attempts-${randomUUID()}@example.test`;
    const loginSubject = `anonymous:${email}`;
    subjects.push({ scope: "login", subject: loginSubject });
    const loginResponses: Response[] = [];
    for (let i = 0; i < 6; i += 1)
      loginResponses.push(
        await login(
          request("/api/identity/login", {
            email,
            password: "incorrect password 2026",
          }),
        ),
      );
    const loginResults = await messages(loginResponses);
    expect(loginResults.slice(0, 5).every(({ status }) => status === 401)).toBe(
      true,
    );
    expect(loginResults[5]?.status).toBe(429);
    expect(JSON.stringify(loginResults[5]?.body)).not.toContain(email);

    const recoveryEmail = `recovery-${randomUUID()}@example.test`;
    const recoverySubject = `anonymous:${recoveryEmail}`;
    subjects.push({ scope: "password-reset", subject: recoverySubject });
    const recoveryResponses: Response[] = [];
    for (let i = 0; i < 4; i += 1)
      recoveryResponses.push(
        await forgot(
          request("/api/identity/password/forgot", { email: recoveryEmail }),
        ),
      );
    const recoveryResults = await messages(recoveryResponses);
    expect(recoveryResults.slice(0, 3).every(({ status }) => status === 404)).toBe(
      true,
    );
    expect(recoveryResults[3]?.status).toBe(429);
    expect(JSON.stringify(recoveryResults[3]?.body)).not.toContain(recoveryEmail);

    const handle = randomUUID();
    const binding = randomUUID();
    const challengeSubject = `challenge:${handle}`;
    subjects.push({ scope: "totp-challenge", subject: challengeSubject });
    const cookieName = identityCookiePolicy(serverEnvironment).preAuth.name;
    const cookie = `${cookieName}=${encodeURIComponent(encodePreAuth(handle, binding))}`;
    const challengeResponses: Response[] = [];
    for (let i = 0; i < 6; i += 1)
      challengeResponses.push(
        await completeTwoFactor(
          request(
            "/api/identity/two-factor/complete",
            { factor: "totp", code: "000000" },
            { cookie },
          ),
        ),
      );
    const challengeResults = await messages(challengeResponses);
    expect(challengeResults.slice(0, 5).every(({ status }) => status === 401)).toBe(
      true,
    );
    expect(challengeResults[5]?.status).toBe(429);
    expect(JSON.stringify(challengeResults[5]?.body)).not.toContain(handle);
  });
});
