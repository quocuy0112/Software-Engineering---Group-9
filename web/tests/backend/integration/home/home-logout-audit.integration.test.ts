import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  sameOrigin: vi.fn(),
  validProof: vi.fn(),
  signOut: vi.fn(),
  append: vi.fn(),
}));

vi.mock("@/backend/auth/session/require-session", () => ({ requireSession: mocks.current }));
vi.mock("@/backend/security/csrf/csrf", () => ({ validateSameOrigin: mocks.sameOrigin }));
vi.mock("@/backend/security/csrf/csrf-proof", () => ({ validCsrfProof: mocks.validProof }));
vi.mock("@/backend/auth/better-auth/better-auth-session-gateway", () => ({
  BetterAuthSessionGateway: class { signOut = mocks.signOut; },
}));
vi.mock("@/backend/repositories/audit/prisma-audit-repository", () => ({
  PrismaAuditRepository: class { append = mocks.append; },
}));

import { POST } from "@/app/api/identity/logout/route";

const request = () =>
  new Request("http://localhost:3001/api/identity/logout", {
    method: "POST",
    headers: { origin: "http://localhost:3001", "x-csrf-token": "proof" },
  });

describe("existing logout audit boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.current.mockResolvedValue({ userId: "user-1", sessionId: "session-1" });
    mocks.sameOrigin.mockReturnValue(true);
    mocks.validProof.mockReturnValue(true);
    mocks.signOut.mockResolvedValue(new Response(null, { status: 204 }));
    mocks.append.mockResolvedValue(undefined);
  });

  it("records exactly one minimal logout.succeeded event after valid logout", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.append).toHaveBeenCalledOnce();
    expect(mocks.append).toHaveBeenCalledWith({
      occurredAt: expect.any(Date),
      actorType: "user",
      actorUserId: "user-1",
      actorSessionId: "session-1",
      action: "logout.succeeded",
      targetType: "session",
      targetId: null,
      result: "SUCCESS",
      correlationId: expect.any(String),
      context: { reason: "user_requested" },
    });
  });

  it("does not create false success audit for rejected CSRF or idempotent no-session logout", async () => {
    mocks.sameOrigin.mockReturnValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.append).not.toHaveBeenCalled();
    mocks.current.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.append).not.toHaveBeenCalled();
  });
});
