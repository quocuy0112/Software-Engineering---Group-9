import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import { auth } from "@/backend/auth/cookies/config";
import { BetterAuthPasswordGateway } from "@/backend/auth/better-auth/better-auth-password-gateway";
import { cvConfiguration } from "@/backend/cv/config";
import { FilesystemPrivateCvStorage } from "@/backend/cv/storage/filesystem";
import { prisma } from "@/backend/database/prisma";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { POST as reserveUpload } from "@/app/api/account/cv-imports/route";
import { PUT as uploadContent } from "@/app/api/account/cv-imports/[uploadId]/content/route";
import { GET as getImport } from "@/app/api/account/cv-imports/[uploadId]/route";
import {
  GET as getDraft,
  PATCH as patchDraft,
} from "@/app/api/account/cv-drafts/[draftId]/route";
import { POST as confirmDraft } from "@/app/api/account/cv-drafts/[draftId]/confirm/route";
import { createCredentialFixture } from "../../../helpers/credential-fixture";
import { createSyntheticPdf } from "../../../helpers/cv-document-buffers";
import {
  cleanupReviewAccounts,
  seedReviewDraft,
} from "../../../helpers/cv-review-fixture";

const origin = "http://localhost:3001";
const password = "CV route session matrix 2026!";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type AuthenticatedSession = Readonly<{
  cookie: string;
  sessionId: string;
}>;

type RouteFixture = Readonly<{
  accountId: string;
  profileId: string;
  uploadId: string;
  draftId: string;
  email: string;
}>;

type SessionState =
  | "MISSING"
  | "IDLE_EXPIRED"
  | "ABSOLUTE_EXPIRED"
  | "LOGOUT_REVOKED"
  | "PASSWORD_RESET_REVOKED";

let fixture: RouteFixture;

function cookieFrom(response: Response): string {
  return (
    response.headers
      .getSetCookie()
      .find((value) => value.startsWith("smarthire.session="))
      ?.split(";", 1)[0] ?? ""
  );
}

async function login(): Promise<AuthenticatedSession> {
  const response = await auth.handler(
    new Request(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        origin,
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: fixture.email, password }),
    }),
  );
  const cookie = cookieFrom(response);
  const current = await new BetterAuthPasswordGateway().authoritativeSession(
    new Headers({ cookie }),
  );
  if (response.status !== 200 || !cookie || !current) {
    throw new Error("CV_ROUTE_SESSION_LOGIN_FAILED");
  }
  return { cookie, sessionId: current.sessionId };
}

function headers(
  session: AuthenticatedSession | null,
  mutation: boolean,
  extra: HeadersInit = {},
): Headers {
  const result = new Headers({
    origin,
    "sec-fetch-site": "same-origin",
    ...Object.fromEntries(new Headers(extra).entries()),
  });
  if (session) {
    result.set("cookie", session.cookie);
    if (mutation) result.set("x-csrf-token", csrfProof(session.sessionId));
  }
  return result;
}

async function createPendingPasswordReset(accountId: string) {
  const suffix = randomUUID();
  const now = new Date();
  const token = await prisma.securityToken.create({
    data: {
      userId: accountId,
      purpose: "RESET_PASSWORD",
      status: "CONSUMED",
      tokenDigest: `route-session-token-${suffix}`,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
      consumedAt: now,
      createdByRequestId: `route-session-${suffix}`,
    },
  });
  const operation = await prisma.passwordResetOperation.create({
    data: {
      id: `route-session-reset-${suffix}`,
      userId: accountId,
      securityTokenId: token.id,
      operationKey: `route-session-operation-${suffix}`,
      auditIntentKey: `route-session-audit-${suffix}`,
      notificationIdempotencyKey: `route-session-notification-${suffix}`,
    },
  });
  return async () => {
    await prisma.passwordResetOperation.deleteMany({
      where: { id: operation.id },
    });
    await prisma.securityToken.deleteMany({ where: { id: token.id } });
  };
}

async function sessionForState(state: SessionState) {
  if (state === "MISSING") {
    return { session: null, cleanup: async () => undefined };
  }
  const session = await login();
  const now = new Date();
  let cleanup: () => Promise<void> = async () => undefined;
  switch (state) {
    case "IDLE_EXPIRED":
      await prisma.session.update({
        where: { id: session.sessionId },
        data: { lastActivityAt: new Date(now.getTime() - 31 * 60_000) },
      });
      break;
    case "ABSOLUTE_EXPIRED":
      await prisma.session.update({
        where: { id: session.sessionId },
        data: {
          createdAt: new Date(now.getTime() - 8 * 86_400_000),
          expiresAt: new Date(now.getTime() - 1),
          absoluteExpiresAt: new Date(now.getTime() - 1),
        },
      });
      break;
    case "LOGOUT_REVOKED":
      await prisma.session.update({
        where: { id: session.sessionId },
        data: { revokedAt: now, revocationReason: "logout" },
      });
      break;
    case "PASSWORD_RESET_REVOKED":
      cleanup = await createPendingPasswordReset(fixture.accountId);
      break;
  }
  return { session, cleanup };
}

const deniedRouteCases = [
  {
    label: "upload reservation POST",
    invoke: (session: AuthenticatedSession | null) =>
      reserveUpload(
        new Request(`${origin}/api/account/cv-imports`, {
          method: "POST",
          headers: headers(session, true, {
            "content-type": "application/json",
            "idempotency-key": `route-session-${randomUUID()}`,
          }),
          body: JSON.stringify({
            displayFilename: "session-boundary.pdf",
            declaredMediaType: "application/pdf",
            declaredBytes: 1,
            parserClass: "DETERMINISTIC_INTERNAL",
          }),
        }),
      ),
  },
  {
    label: "upload content PUT",
    invoke: (session: AuthenticatedSession | null) =>
      uploadContent(
        new Request(
          `${origin}/api/account/cv-imports/${fixture.uploadId}/content`,
          {
            method: "PUT",
            headers: headers(session, true, {
              "content-type": "application/pdf",
              "content-length": "1",
              "idempotency-key": `route-session-${randomUUID()}`,
            }),
            body: new Uint8Array([0x25]),
          },
        ),
        { params: Promise.resolve({ uploadId: fixture.uploadId }) },
      ),
  },
  {
    label: "import status GET",
    invoke: (session: AuthenticatedSession | null) =>
      getImport(
        new Request(`${origin}/api/account/cv-imports/${fixture.uploadId}`, {
          headers: headers(session, false),
        }),
        { params: Promise.resolve({ uploadId: fixture.uploadId }) },
      ),
  },
  {
    label: "draft review GET",
    invoke: (session: AuthenticatedSession | null) =>
      getDraft(
        new Request(`${origin}/api/account/cv-drafts/${fixture.draftId}`, {
          headers: headers(session, false),
        }),
        { params: Promise.resolve({ draftId: fixture.draftId }) },
      ),
  },
  {
    label: "draft review PATCH",
    invoke: (session: AuthenticatedSession | null) =>
      patchDraft(
        new Request(`${origin}/api/account/cv-drafts/${fixture.draftId}`, {
          method: "PATCH",
          headers: headers(session, true, {
            "content-type": "application/json",
          }),
          body: "{}",
        }),
        { params: Promise.resolve({ draftId: fixture.draftId }) },
      ),
  },
  {
    label: "draft confirmation POST",
    invoke: (session: AuthenticatedSession | null) =>
      confirmDraft(
        new Request(
          `${origin}/api/account/cv-drafts/${fixture.draftId}/confirm`,
          {
            method: "POST",
            headers: headers(session, true, {
              "content-type": "application/json",
              "idempotency-key": `route-session-${randomUUID()}`,
            }),
            body: "{}",
          },
        ),
        { params: Promise.resolve({ draftId: fixture.draftId }) },
      ),
  },
] as const;

beforeAll(async () => {
  const suffix = randomUUID();
  const email = `cv-route-session-${suffix}@example.test`;
  const user = await createCredentialFixture({
    name: "CV Route Session Candidate",
    email,
    password,
  });
  const identity = await prisma.candidateIdentity.create({
    data: { userId: user.id, profile: { create: {} } },
    include: { profile: true },
  });
  if (!identity.profile) throw new Error("CV_ROUTE_SESSION_PROFILE_MISSING");
  const client = await pool.connect();
  try {
    const seeded = await seedReviewDraft(client, "route-session", {
      existingAccount: {
        accountId: user.id,
        profileId: identity.profile.id,
      },
      profileRevision: 0,
    });
    fixture = {
      accountId: user.id,
      profileId: identity.profile.id,
      uploadId: seeded.uploadId,
      draftId: seeded.draftId,
      email,
    };
  } finally {
    client.release();
  }
});

afterAll(async () => {
  if (fixture?.accountId) {
    const filesystemArtifacts = await prisma.cvStoredArtifact.findMany({
      where: {
        accountId: fixture.accountId,
        storageAdapter: "filesystem",
      },
      select: { storageLocator: true },
    });
    if (
      filesystemArtifacts.length > 0 &&
      cvConfiguration.storage.adapter === "filesystem" &&
      cvConfiguration.storage.localRoot
    ) {
      const storage = new FilesystemPrivateCvStorage({
        root: cvConfiguration.storage.localRoot,
      });
      await Promise.allSettled(
        filesystemArtifacts.map(({ storageLocator }) =>
          storage.delete(storageLocator),
        ),
      );
    }
    const client = await pool.connect();
    try {
      await cleanupReviewAccounts(client, [fixture.accountId]);
    } finally {
      client.release();
    }
  }
  await pool.end();
  await prisma.$disconnect();
});

describe("Feature 004 real Route Handler session boundary", () => {
  for (const state of [
    "MISSING",
    "IDLE_EXPIRED",
    "ABSOLUTE_EXPIRED",
    "LOGOUT_REVOKED",
    "PASSWORD_RESET_REVOKED",
  ] as const) {
    for (const routeCase of deniedRouteCases) {
      it(`rejects ${state} for the real ${routeCase.label}`, async () => {
        const stateFixture = await sessionForState(state);
        try {
          const response = await routeCase.invoke(stateFixture.session);
          expect(response.status).toBe(401);
          await expect(response.json()).resolves.toMatchObject({
            error: { code: "AUTHENTICATION_REQUIRED" },
          });
        } finally {
          await stateFixture.cleanup();
        }
      });
    }
  }

  it("accepts the ACTIVE baseline through every real handler", async () => {
    const active = await login();
    const document = createSyntheticPdf("Synthetic route session candidate");
    const key = `route-session-active-${randomUUID()}`;
    const reservation = await reserveUpload(
      new Request(`${origin}/api/account/cv-imports`, {
        method: "POST",
        headers: headers(active, true, {
          "content-type": "application/json",
          "idempotency-key": key,
        }),
        body: JSON.stringify({
          displayFilename: "session-boundary.pdf",
          declaredMediaType: "application/pdf",
          declaredBytes: document.byteLength,
          parserClass: "DETERMINISTIC_INTERNAL",
        }),
      }),
    );
    expect(reservation.status).toBe(201);
    const reservationBody = (await reservation.json()) as { uploadId: string };

    const content = await uploadContent(
      new Request(
        `${origin}/api/account/cv-imports/${reservationBody.uploadId}/content`,
        {
          method: "PUT",
          headers: headers(active, true, {
            "content-type": "application/pdf",
            "content-length": String(document.byteLength),
            "idempotency-key": key,
          }),
          body: Uint8Array.from(document),
        },
      ),
      { params: Promise.resolve({ uploadId: reservationBody.uploadId }) },
    );
    expect(content.status).toBe(202);

    const status = await getImport(
      new Request(
        `${origin}/api/account/cv-imports/${reservationBody.uploadId}`,
        { headers: headers(active, false) },
      ),
      { params: Promise.resolve({ uploadId: reservationBody.uploadId }) },
    );
    expect(status.status).toBe(200);

    const draft = await getDraft(
      new Request(`${origin}/api/account/cv-drafts/${fixture.draftId}`, {
        headers: headers(active, false),
      }),
      { params: Promise.resolve({ draftId: fixture.draftId }) },
    );
    expect(draft.status).toBe(200);
    const comparison = (await draft.json()) as {
      draftRevision: number;
      sourceProfileRevision: number;
      reviewedProfileRevision: number;
      proposals: unknown;
      reviewDecisions: {
        reviewComplete: boolean;
        scalars: Array<{ proposalId: string; action: string }>;
        experiences: unknown[];
        education: unknown[];
        skills: unknown[];
        socialLinks: unknown[];
      };
    };
    const reviewDecisions = {
      ...comparison.reviewDecisions,
      reviewComplete: true,
      scalars: comparison.reviewDecisions.scalars.map((decision, index) => ({
        ...decision,
        action: index === 0 ? "ADD" : decision.action,
      })),
    };
    const saved = await patchDraft(
      new Request(`${origin}/api/account/cv-drafts/${fixture.draftId}`, {
        method: "PATCH",
        headers: headers(active, true, { "content-type": "application/json" }),
        body: JSON.stringify({
          baseDraftRevision: comparison.draftRevision,
          reviewedProfileRevision: comparison.reviewedProfileRevision,
          proposals: comparison.proposals,
          reviewDecisions,
        }),
      }),
      { params: Promise.resolve({ draftId: fixture.draftId }) },
    );
    expect(saved.status).toBe(200);
    const savedBody = (await saved.json()) as {
      draftRevision: number;
      reviewedProfileRevision: number;
    };

    const confirmed = await confirmDraft(
      new Request(
        `${origin}/api/account/cv-drafts/${fixture.draftId}/confirm`,
        {
          method: "POST",
          headers: headers(active, true, {
            "content-type": "application/json",
            "idempotency-key": `route-session-confirm-${randomUUID()}`,
          }),
          body: JSON.stringify({
            draftRevision: savedBody.draftRevision,
            sourceProfileRevision: comparison.sourceProfileRevision,
            reviewedProfileRevision: savedBody.reviewedProfileRevision,
          }),
        },
      ),
      { params: Promise.resolve({ draftId: fixture.draftId }) },
    );
    expect(confirmed.status).toBe(201);
  });

  it("keeps session resolution centralized in the shared CV boundary", async () => {
    const routeSources = await Promise.all(
      [
        "src/app/api/account/cv-imports/route.ts",
        "src/app/api/account/cv-imports/[uploadId]/content/route.ts",
        "src/app/api/account/cv-imports/[uploadId]/handler.ts",
        "src/app/api/account/cv-drafts/[draftId]/route.ts",
        "src/app/api/account/cv-drafts/[draftId]/confirm/route.ts",
      ].map((path) => readFile(resolve(process.cwd(), path), "utf8")),
    );
    for (const source of routeSources) {
      expect(source).not.toMatch(/auth\.api|getSession|authoritativeSession/u);
      expect(source).toContain("CvAccountRequestBoundary");
    }
    const boundary = await readFile(
      resolve(
        process.cwd(),
        "src/backend/security/cv-account-request-boundary.ts",
      ),
      "utf8",
    );
    expect(boundary).toContain("requireSession(request.headers)");
  });
});
