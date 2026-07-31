import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { accountErrorSchema } from "@/shared/contracts/account/common";
import {
  candidateProfileSchema,
  profileMutationOutcomeSchema,
  profileSectionMutationSchema,
  skillSuggestionsQuerySchema,
  skillSuggestionsResponseSchema,
} from "@/shared/contracts/account/profile";
import {
  accountIdentityMutationOutcomeSchema,
  accountIdentitySchema,
  accountNameMutationSchema,
} from "@/shared/contracts/account/identity";
import {
  emailChangeProofSchema,
  emailChangeQueuedSchema,
  emailChangeRequestSchema,
  emailChangeVerificationOutcomeSchema,
} from "@/shared/contracts/account/email-change";
import {
  accountPreferencesMutationOutcomeSchema,
  accountPreferencesMutationSchema,
  accountPreferencesSchema,
} from "@/shared/contracts/account/preferences";
import {
  passwordChangeOutcomeSchema,
  passwordChangeRequestSchema,
} from "@/shared/contracts/account/password-change";
import { validateProfilePhone } from "@/backend/services/profile/profile-validation";
import {
  GET as getProfile,
  PATCH as patchProfile,
} from "@/app/api/account/profile/route";
import { GET as suggestSkills } from "@/app/api/account/profile/skills/suggestions/route";
import {
  GET as getIdentity,
  PATCH as patchIdentity,
} from "@/app/api/account/identity/route";
import {
  GET as getPreferences,
  PUT as putPreferences,
} from "@/app/api/account/preferences/route";
import { POST as requestEmailChange } from "@/app/api/account/email-change/request/route";
import { POST as verifyEmailChange } from "@/app/api/account/email-change/verify/route";
import { POST as changePassword } from "@/app/api/account/password/change/route";

const openapi = readFileSync(
  resolve(
    process.cwd(),
    "../spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml",
  ),
  "utf8",
);

const spec = readFileSync(
  resolve(
    process.cwd(),
    "../spec-kit/specs/002-candidate-profile-account-management/spec.md",
  ),
  "utf8",
);

const httpMethods = ["get", "post", "put", "patch", "delete"] as const;

function operationBlock(path: string, method: (typeof httpMethods)[number]) {
  const pathMarker = `  ${path}:`;
  const pathStart = openapi.indexOf(pathMarker);
  expect(pathStart, `OpenAPI path ${path}`).toBeGreaterThanOrEqual(0);
  const nextPath = openapi.indexOf("\n  /", pathStart + pathMarker.length);
  const pathEnd = nextPath === -1 ? openapi.length : nextPath;
  const pathBlock = openapi.slice(pathStart, pathEnd);
  const methodMarker = `\n    ${method}:`;
  const methodStart = pathBlock.indexOf(methodMarker);
  expect(methodStart, `${method.toUpperCase()} ${path}`).toBeGreaterThanOrEqual(
    0,
  );
  const possibleEnds = httpMethods
    .map((candidate) =>
      pathBlock.indexOf(
        `\n    ${candidate}:`,
        methodStart + methodMarker.length,
      ),
    )
    .filter((index) => index >= 0);
  const methodEnd =
    possibleEnds.length > 0 ? Math.min(...possibleEnds) : pathBlock.length;
  return pathBlock.slice(methodStart, methodEnd);
}

function componentResponseBlock(name: string) {
  const responsesStart = openapi.indexOf("\n  responses:");
  expect(responsesStart).toBeGreaterThanOrEqual(0);
  const responses = openapi.slice(responsesStart);
  const marker = `\n    ${name}:`;
  const start = responses.indexOf(marker);
  expect(start, `component response ${name}`).toBeGreaterThanOrEqual(0);
  const next = responses.slice(start + marker.length).search(/\n {4}[A-Za-z]/u);
  return responses.slice(
    start,
    next === -1 ? responses.length : start + marker.length + next,
  );
}

function responseEntries(block: string) {
  const matches = [...block.matchAll(/^ {8}"(\d{3})":/gmu)];
  return matches.map((match, index) => ({
    status: match[1],
    block: block.slice(match.index, matches[index + 1]?.index ?? block.length),
  }));
}

const operations = [
  {
    path: "/api/account/profile",
    method: "get",
    operationId: "getOwnCandidateProfile",
    statuses: ["200", "401"],
    responseRef: "CandidateProfile",
    sensitive: true,
  },
  {
    path: "/api/account/profile",
    method: "patch",
    operationId: "saveOwnCandidateProfileSection",
    statuses: ["200", "400", "401", "403", "413"],
    responseRef: "ProfileMutationOutcome",
    sensitive: true,
  },
  {
    path: "/api/account/profile/skills/suggestions",
    method: "get",
    operationId: "suggestSkills",
    statuses: ["200", "400", "401"],
    responseRef: "Skill",
    sensitive: false,
  },
  {
    path: "/api/account/identity",
    method: "get",
    operationId: "getOwnAccountIdentity",
    statuses: ["200", "401"],
    responseRef: "AccountIdentity",
    sensitive: true,
  },
  {
    path: "/api/account/identity",
    method: "patch",
    operationId: "updateOwnAccountName",
    statuses: ["200", "400", "401", "403"],
    responseRef: "AccountIdentityMutationOutcome",
    sensitive: true,
  },
  {
    path: "/api/account/preferences",
    method: "get",
    operationId: "getOwnAccountPreferences",
    statuses: ["200", "401"],
    responseRef: "AccountPreferences",
    sensitive: true,
  },
  {
    path: "/api/account/preferences",
    method: "put",
    operationId: "replaceOwnAccountPreferences",
    statuses: ["200", "400", "401", "403"],
    responseRef: "AccountPreferencesMutationOutcome",
    sensitive: true,
  },
  {
    path: "/api/account/email-change/request",
    method: "post",
    operationId: "requestOwnEmailChange",
    statuses: ["202", "400", "401", "403", "409", "429", "503"],
    responseRef: "EmailChangeQueued",
    sensitive: true,
  },
  {
    path: "/api/account/email-change/verify",
    method: "post",
    operationId: "verifyEmailChange",
    statuses: ["200", "400", "403", "409", "503"],
    responseRef: "Outcome",
    sensitive: true,
  },
  {
    path: "/api/account/password/change",
    method: "post",
    operationId: "changeOwnPassword",
    statuses: ["200", "400", "401", "403", "409", "429", "503"],
    responseRef: "Outcome",
    sensitive: true,
  },
] as const;

const emptyProfile = {
  revision: 0,
  empty: true,
  basics: { headline: null, summary: null, phone: null, location: null },
  skills: [],
  experience: [],
  education: [],
  socialLinks: [],
};
const identity = {
  name: "Nguyen Van An",
  email: "candidate@example.test",
  emailVerified: true,
  accountState: "ACTIVE" as const,
  createdAt: "2026-07-31T00:00:00.000Z",
  pendingEmailChange: null,
};
const preferences = {
  language: "vi" as const,
  timezone: "Asia/Ho_Chi_Minh",
  emailNotifications: {
    application_updates: true,
    job_recommendations: true,
    account_security: true as const,
  },
  timezoneSupported: true,
};

describe("Feature 002 OpenAPI, Zod, and Route Handler parity", () => {
  it("documents exactly ten local operations with exact statuses and resolvable refs", () => {
    expect(operations).toHaveLength(10);
    for (const operation of operations) {
      const block = operationBlock(operation.path, operation.method);
      expect(block).toContain(`operationId: ${operation.operationId}`);
      expect(responseEntries(block).map(({ status }) => status)).toEqual(
        operation.statuses,
      );
      expect(block).toContain(
        `$ref: "#/components/schemas/${operation.responseRef}"`,
      );
    }

    const localRefs = [
      ...openapi.matchAll(/\$ref: "#\/components\/[^/]+\/([^"]+)"/gmu),
    ].map((match) => match[1]);
    expect(localRefs.length).toBeGreaterThan(0);
    for (const name of new Set(localRefs)) {
      expect(openapi, `local component ${name}`).toMatch(
        new RegExp(`^    ${name}:`, "mu"),
      );
    }
    expect(openapi).not.toMatch(/\$ref:\s*["']?https?:/u);
  });

  it("declares no-store on every response of the exact nine sensitive operations", () => {
    const sensitive = operations.filter((operation) => operation.sensitive);
    expect(sensitive).toHaveLength(9);
    for (const operation of sensitive) {
      for (const response of responseEntries(
        operationBlock(operation.path, operation.method),
      )) {
        const component = response.block.match(
          /\$ref: "#\/components\/responses\/([^"]+)"/u,
        )?.[1];
        const declaration = component
          ? componentResponseBlock(component)
          : response.block;
        expect(
          declaration,
          `${operation.operationId} response ${response.status}`,
        ).toContain('$ref: "#/components/headers/NoStoreHeader"');
      }
    }
    expect(openapi).toContain('const: "no-store, max-age=0"');
  });

  it("keeps every operation response schema strict against leaked fields", () => {
    const strictResponses: Array<[string, ZodType, Record<string, unknown>]> = [
      ["profile GET", candidateProfileSchema, emptyProfile],
      [
        "profile PATCH",
        profileMutationOutcomeSchema,
        {
          profile: emptyProfile,
          conflictApplied: false,
          warnings: [],
          message: "Saved.",
        },
      ],
      ["skill suggestions GET", skillSuggestionsResponseSchema, { skills: [] }],
      ["identity GET", accountIdentitySchema, identity],
      [
        "identity PATCH",
        accountIdentityMutationOutcomeSchema,
        { identity, warnings: [], message: "Saved." },
      ],
      ["preferences GET", accountPreferencesSchema, preferences],
      [
        "preferences PUT",
        accountPreferencesMutationOutcomeSchema,
        { preferences, message: "Saved." },
      ],
      [
        "email-change request",
        emailChangeQueuedSchema,
        {
          status: "verification-queued",
          expiresAt: "2026-07-31T00:30:00.000Z",
          message: "Check your email.",
        },
      ],
      [
        "email-change verify",
        emailChangeVerificationOutcomeSchema,
        { status: "success", message: "Email changed." },
      ],
      [
        "password change",
        passwordChangeOutcomeSchema,
        { status: "success", message: "Password changed." },
      ],
    ];
    expect(strictResponses).toHaveLength(10);
    for (const [name, schema, value] of strictResponses) {
      expect(schema.safeParse(value).success, name).toBe(true);
      expect(
        schema.safeParse({ ...value, leakedSecret: "forbidden" }).success,
        name,
      ).toBe(false);
    }
  });

  it("uses strict request schemas that reject client-selected ownership", () => {
    const bodies: Array<[ZodType, Record<string, unknown>]> = [
      [
        profileSectionMutationSchema,
        {
          section: "basics",
          baseRevision: 0,
          basics: {
            headline: null,
            summary: null,
            phone: null,
            location: null,
          },
        },
      ],
      [skillSuggestionsQuerySchema, { query: "Type", limit: "10" }],
      [accountNameMutationSchema, { name: "Nguyen Van An" }],
      [
        accountPreferencesMutationSchema,
        {
          language: "vi",
          timezone: "Asia/Ho_Chi_Minh",
          emailNotifications: preferences.emailNotifications,
        },
      ],
      [
        emailChangeRequestSchema,
        {
          newEmail: "new@example.test",
          currentPassword: "Current password 2026!",
        },
      ],
      [emailChangeProofSchema, { proof: "a".repeat(43) }],
      [
        passwordChangeRequestSchema,
        {
          currentPassword: "Current password 2026!",
          newPassword: "Different password 2026!",
          newPasswordConfirmation: "Different password 2026!",
        },
      ],
    ];
    for (const [schema, body] of bodies) {
      expect(schema.safeParse(body).success).toBe(true);
      expect(
        schema.safeParse({ ...body, userId: "forged-owner" }).success,
      ).toBe(false);
    }
  });

  it("matches FR-017 examples and exact 6/7/15/16 ASCII-digit boundaries", () => {
    const accepted = [
      "0912345678",
      "0912 345 678",
      "+84 912 345 678",
      "(028) 3822-1234",
      "+1 (415) 555-2671",
    ];
    const rejected = [
      "+84",
      "0912--345-678",
      "+84 912 345 678 ext 9",
      "0912/345/678",
      "+84 (912 345-678",
    ];
    for (const value of accepted) {
      expect(spec).toContain(`\`${value}\``);
      expect(validateProfilePhone(value)).toBe(value);
    }
    for (const value of rejected) {
      expect(spec).toContain(`\`${value}\``);
      expect(() => validateProfilePhone(value)).toThrow();
    }
    expect(() => validateProfilePhone("123456")).toThrow();
    expect(validateProfilePhone("1234567")).toBe("1234567");
    expect(validateProfilePhone("123456789012345")).toBe("123456789012345");
    expect(() => validateProfilePhone("1234567890123456")).toThrow();
  });

  it("returns strict safe errors and no-store from all nine live sensitive handlers", async () => {
    const origin = "http://localhost:3001";
    const handlers = [
      getProfile(new Request(`${origin}/api/account/profile`)),
      patchProfile(
        new Request(`${origin}/api/account/profile`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            section: "basics",
            baseRevision: 0,
            basics: emptyProfile.basics,
          }),
        }),
      ),
      getIdentity(new Request(`${origin}/api/account/identity`)),
      patchIdentity(
        new Request(`${origin}/api/account/identity`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Candidate" }),
        }),
      ),
      getPreferences(new Request(`${origin}/api/account/preferences`)),
      putPreferences(
        new Request(`${origin}/api/account/preferences`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preferences),
        }),
      ),
      requestEmailChange(
        new Request(`${origin}/api/account/email-change/request`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            newEmail: "new@example.test",
            currentPassword: "Current password 2026!",
          }),
        }),
      ),
      verifyEmailChange(
        new Request(`${origin}/api/account/email-change/verify`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            "sec-fetch-site": "same-origin",
          },
          body: JSON.stringify({ proof: "malformed" }),
        }),
      ),
      changePassword(
        new Request(`${origin}/api/account/password/change`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPassword: "Current password 2026!",
            newPassword: "Different password 2026!",
            newPasswordConfirmation: "Different password 2026!",
          }),
        }),
      ),
    ];
    const responses = await Promise.all(handlers);
    expect(responses).toHaveLength(9);
    for (const response of responses) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(accountErrorSchema.safeParse(await response.json()).success).toBe(
        true,
      );
    }
  });

  it("keeps the catalog-only tenth handler authenticated and ownership-free", async () => {
    const response = await suggestSkills(
      new Request(
        "http://localhost:3001/api/account/profile/skills/suggestions?query=Type",
      ),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(accountErrorSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/userId|profileId|usageCount/iu);
  });
});
