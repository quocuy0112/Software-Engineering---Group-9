import { describe, expect, it, vi } from "vitest";

import { createCvImportRetryPostHandler } from "@/app/api/account/cv-imports/[uploadId]/retries/handler";
import {
  CvAccountRequestBoundary,
  type CvRequestBoundaryDependencies,
} from "@/backend/security/cv-account-request-boundary";
import { csrfProof } from "@/backend/security/csrf/csrf-proof";
import { cvApiErrorSchema } from "@/shared/contracts/cv-import/common";
import { cvRetryAcceptedSchema } from "@/shared/contracts/cv-import/retry";

const trustedOrigin = "https://app.smarthire.test";
const sessionId = "session_retry_route_fixture";
const accountId = "account_retry_route_fixture";
const uploadId = "upload_retry_route_fixture";
const idempotencyKey = "retry-route-key-0001";

type SessionState = Awaited<
  ReturnType<CvRequestBoundaryDependencies["resolveSession"]>
>;

function harness(
  options: {
    session?: SessionState;
    accountState?: string | null;
    owns?: boolean;
    replayed?: boolean;
  } = {},
) {
  const session: SessionState = options.session ?? {
    state: "VALID",
    accountId,
    sessionId,
  };
  const service = {
    executeForHttp: vi.fn(async () => ({
      outcome: cvRetryAcceptedSchema.parse({
        uploadId,
        status: "SCAN_QUEUED" as const,
        scanRetriesRemaining: 1,
        parseRetriesRemaining: 2,
      }),
      replayed: options.replayed ?? false,
    })),
  };
  const boundary = new CvAccountRequestBoundary({
    trustedOrigin,
    resolveSession: vi.fn(async () => session),
    getAccountState: vi.fn(async () => options.accountState ?? "ACTIVE"),
    owns: vi.fn(async () => options.owns ?? true),
  });
  return {
    post: createCvImportRetryPostHandler({ boundary, service }),
    service,
  };
}

function request(
  body?: string,
  headers: Record<string, string | undefined> = {},
) {
  const values = new Headers({
    origin: trustedOrigin,
    "sec-fetch-site": "same-origin",
    "x-csrf-token": csrfProof(sessionId),
    "idempotency-key": idempotencyKey,
  });
  if (body !== undefined) values.set("content-type", "application/json");
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) values.delete(name);
    else values.set(name, value);
  }
  return new Request(
    `${trustedOrigin}/api/account/cv-imports/${uploadId}/retries`,
    {
      method: "POST",
      headers: values,
      body,
    },
  );
}

function context(id = uploadId) {
  return { params: Promise.resolve({ uploadId: id }) };
}

describe("real CV import retry Route Handler", () => {
  it.each(["MISSING", "EXPIRED", "REVOKED", "PASSWORD_RESET_REVOKED"] as const)(
    "rejects a %s session before retry policy executes",
    async (state) => {
      const { post, service } = harness({ session: { state } });
      const response = await post(request(), context());
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toMatch(/^no-store/u);
      expect(cvApiErrorSchema.safeParse(await response.json()).success).toBe(
        true,
      );
      expect(service.executeForHttp).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["inactive account", { accountState: "SUSPENDED" }, 403],
    ["foreign upload", { owns: false }, 404],
  ] as const)(
    "rejects an %s without consuming a retry",
    async (_label, options, status) => {
      const { post, service } = harness(options);
      const response = await post(request(), context());
      expect(response.status).toBe(status);
      expect(service.executeForHttp).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["foreign origin", { origin: "https://attacker.invalid" }],
    ["cross-site request", { "sec-fetch-site": "cross-site" }],
    ["missing proof", { "x-csrf-token": undefined }],
    ["invalid proof", { "x-csrf-token": "invalid" }],
  ] as const)(
    "rejects %s before consuming a retry",
    async (_label, headers) => {
      const { post, service } = harness();
      const response = await post(request(undefined, headers), context());
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("CSRF_REJECTED");
      expect(service.executeForHttp).not.toHaveBeenCalled();
    },
  );

  it("accepts both an absent body and an exact empty JSON object", async () => {
    const absent = harness();
    const absentResponse = await absent.post(request(), context());
    expect(absentResponse.status).toBe(202);
    expect(absent.service.executeForHttp).toHaveBeenCalledOnce();

    const emptyObject = harness();
    const emptyResponse = await emptyObject.post(request("{}"), context());
    expect(emptyResponse.status).toBe(202);
    expect(emptyObject.service.executeForHttp).toHaveBeenCalledOnce();
  });

  it.each([
    ["malformed JSON", "{", {}, 400],
    ["unknown metadata", '{"stage":"SCAN"}', {}, 400],
    ["oversized body", "{}", { "content-length": "257" }, 413],
    ["wrong media type", "{}", { "content-type": "text/plain" }, 415],
    ["declared absent bytes", undefined, { "content-length": "2" }, 400],
    [
      "wrong media type without a body",
      undefined,
      { "content-type": "text/plain" },
      415,
    ],
  ] as const)(
    "rejects %s before consuming a retry",
    async (_label, body, headers, status) => {
      const { post, service } = harness();
      const response = await post(request(body, headers), context());
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toMatch(/^no-store/u);
      expect(cvApiErrorSchema.safeParse(await response.json()).success).toBe(
        true,
      );
      expect(service.executeForHttp).not.toHaveBeenCalled();
    },
  );

  it("requires the retry-specific idempotency header", async () => {
    const { post, service } = harness();
    const response = await post(
      request(undefined, { "idempotency-key": undefined }),
      context(),
    );
    expect(response.status).toBe(400);
    expect(service.executeForHttp).not.toHaveBeenCalled();
  });

  it("returns 202 for new work and 200 for exact replay with safe metadata", async () => {
    for (const replayed of [false, true]) {
      const { post, service } = harness({ replayed });
      const response = await post(request(), context());
      expect(response.status).toBe(replayed ? 200 : 202);
      expect(response.headers.get("cache-control")).toMatch(/^no-store/u);
      expect(response.headers.get("retry-after")).toBe("1");
      expect(
        cvRetryAcceptedSchema.safeParse(await response.json()).success,
      ).toBe(true);
      expect(service.executeForHttp).toHaveBeenCalledWith({
        accountId,
        uploadId,
        idempotencyKey,
      });
    }
  });

  it("maps an invalid route identifier to the uniform not-found response", async () => {
    const { post, service } = harness();
    const response = await post(request(), context("x"));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("CV_IMPORT_NOT_FOUND");
    expect(service.executeForHttp).not.toHaveBeenCalled();
  });
});
