import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  CvAccountRequestBoundary,
  CvRequestBoundaryError,
  cvJsonResponse,
} from "@/backend/security/cv-account-request-boundary";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { createCvImportFixture } from "../../../helpers/cv-import-fixture";

type SessionState =
  | "MISSING"
  | "EXPIRED"
  | "REVOKED"
  | "PASSWORD_RESET_REVOKED"
  | "VALID";

const shapes = [
  ["upload reservation", "upload", "POST"],
  ["upload content", "upload", "PUT"],
  ["parse/import status", "upload", "GET"],
  ["draft review", "draft", "PATCH"],
  ["confirmation", "draft", "POST"],
] as const;

function request(method: string, body?: unknown, headers?: HeadersInit) {
  return new Request("http://localhost:3001/api/account/cv-imports/fixture", {
    method,
    headers: {
      origin: "http://localhost:3001",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function harness(sessionState: SessionState = "VALID") {
  const fixture = createCvImportFixture();
  const owner = fixture.owner;
  const sessionId = "session_fixture";
  const owns = vi.fn(
    async (input: { accountId: string; resourceId: string }) =>
      input.accountId === owner.id && input.resourceId === "owned-resource",
  );
  const boundary = new CvAccountRequestBoundary({
    trustedOrigin: "http://localhost:3001",
    resolveSession: async () =>
      sessionState === "VALID"
        ? {
            state: "VALID" as const,
            accountId: owner.id,
            sessionId,
          }
        : { state: sessionState },
    getAccountState: async () => "ACTIVE",
    owns,
  });
  return { boundary, fixture, owner, sessionId, owns };
}

describe("CvAccountRequestBoundary Foundation middleware harness", () => {
  it.each([
    ["missing session with no cookie/session", "MISSING"],
    ["existing session beyond idle or absolute TTL", "EXPIRED"],
    ["logout or explicitly revoked session", "REVOKED"],
    ["password-reset-revoked session", "PASSWORD_RESET_REVOKED"],
  ] as const)("denies %s uniformly", async (_label, sessionState) => {
    const { boundary } = harness(sessionState);
    for (const [, resourceType, method] of shapes) {
      await expect(
        boundary.authorize(request(method), {
          mutation: method !== "GET",
          resource:
            resourceType === "upload"
              ? { type: "upload", id: "owned-resource" }
              : { type: "draft", id: "owned-resource" },
        }),
      ).rejects.toMatchObject({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
      });
    }
  });

  it.each(shapes)(
    "authorizes the valid ACTIVE baseline for mock %s shape",
    async (_label, resourceType, method) => {
      const { boundary, owner, sessionId } = harness();
      const result = await boundary.authorize(
        request(method, undefined, {
          "x-csrf-token": csrfProof(sessionId),
        }),
        {
          mutation: method !== "GET",
          resource:
            resourceType === "upload"
              ? { type: "upload", id: "owned-resource" }
              : { type: "draft", id: "owned-resource" },
        },
      );
      expect(result).toEqual({ accountId: owner.id, sessionId });
    },
  );

  it("derives ownership from the session and hides foreign/missing IDs", async () => {
    const { boundary, owner, owns } = harness();
    for (const resourceId of ["foreign-resource", "missing-resource"]) {
      await expect(
        boundary.authorize(request("GET"), {
          resource: { type: "upload", id: resourceId },
        }),
      ).rejects.toMatchObject({ status: 404, code: "CV_IMPORT_NOT_FOUND" });
    }
    expect(owns).toHaveBeenCalledWith({
      accountId: owner.id,
      resourceId: "foreign-resource",
      resourceType: "upload",
    });
  });

  it.each([
    ["cross-site Fetch Metadata", { "sec-fetch-site": "cross-site" }],
    ["foreign Origin", { origin: "https://attacker.example" }],
    ["missing CSRF proof", {}],
    ["invalid CSRF proof", { "x-csrf-token": "invalid" }],
  ])("rejects mutation proof: %s", async (_label, headers) => {
    const { boundary } = harness();
    await expect(
      boundary.authorize(request("POST", {}, headers), { mutation: true }),
    ).rejects.toMatchObject({ status: 403, code: "CSRF_REJECTED" });
  });

  it("enforces JSON byte caps and forbidden owner/provider/storage fields", async () => {
    const { boundary, sessionId } = harness();
    const schema = z
      .object({
        parserClass: z.enum(["DETERMINISTIC_INTERNAL", "EXTERNAL_OPENAI"]),
      })
      .strict();
    const headers = { "x-csrf-token": csrfProof(sessionId) };
    await expect(
      boundary.readJson(
        request(
          "POST",
          { parserClass: "DETERMINISTIC_INTERNAL", accountId: "forged" },
          headers,
        ),
        schema,
        256,
      ),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    for (const forbidden of ["ownerId", "providerUrl", "storageLocator"]) {
      await expect(
        boundary.readJson(
          request(
            "POST",
            { parserClass: "DETERMINISTIC_INTERNAL", [forbidden]: "forged" },
            headers,
          ),
          z.record(z.string(), z.unknown()),
          256,
        ),
      ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    }
    await expect(
      boundary.readJson(
        request("POST", { parserClass: "x".repeat(400) }, headers),
        schema,
        64,
      ),
    ).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("allows upload endpoints to keep type and size validation messages specific", async () => {
    const { boundary } = harness();
    const schema = z
      .object({
        declaredMediaType: z.enum(["application/pdf"]),
        declaredBytes: z.number().int().max(5_000_000),
      })
      .strict();
    const message = (issue: { path: PropertyKey[]; code: string }) =>
      issue.path[0] === "declaredMediaType"
        ? "Only PDF, DOC, or DOCX files are supported."
        : issue.path[0] === "declaredBytes" && issue.code === "too_big"
          ? "File size must not exceed 5MB."
          : undefined;

    await expect(
      boundary.readJson(
        request("POST", { declaredMediaType: "text/plain", declaredBytes: 1 }),
        schema,
        256,
        { validationMessage: message },
      ),
    ).rejects.toMatchObject({
      message: "Only PDF, DOC, or DOCX files are supported.",
    });
    await expect(
      boundary.readJson(
        request("POST", {
          declaredMediaType: "application/pdf",
          declaredBytes: 5_000_001,
        }),
        schema,
        256,
        { validationMessage: message },
      ),
    ).rejects.toMatchObject({
      message: "File size must not exceed 5MB.",
    });
  });

  it("enforces bounded raw bodies without accepting forged content lengths", async () => {
    const { boundary } = harness();
    const valid = new Request("http://localhost:3001/upload", {
      method: "PUT",
      headers: { "content-length": "4", "content-type": "application/pdf" },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    const bytes = await boundary.readRaw(valid, {
      maximumBytes: 4,
      expectedBytes: 4,
    });
    expect(bytes.byteLength).toBe(4);
    await expect(
      boundary.readRaw(
        new Request("http://localhost:3001/upload", {
          method: "PUT",
          headers: { "content-length": "5" },
          body: new Uint8Array([1, 2, 3, 4, 5]),
        }),
        { maximumBytes: 4, expectedBytes: 5 },
      ),
    ).rejects.toBeInstanceOf(CvRequestBoundaryError);
  });

  it("always returns no-store responses", async () => {
    const response = cvJsonResponse({ state: "fixture" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});
