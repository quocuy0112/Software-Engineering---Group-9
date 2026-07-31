import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/backend/services/recovery/reset-password", () => ({
  ResetPasswordService: class {
    execute = execute;
  },
}));

import { POST } from "@/app/api/identity/password/reset/route";

function request(body: unknown, sameOrigin = true) {
  return new Request("http://localhost:3001/api/identity/password/reset", {
    method: "POST",
    headers: sameOrigin
      ? {
          "content-type": "application/json",
          origin: "http://localhost:3001",
          "sec-fetch-site": "same-origin",
        }
      : {
          "content-type": "application/json",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
    body: JSON.stringify(body),
  });
}

describe("reset-password route", () => {
  beforeEach(() => execute.mockReset());

  it("returns generic invalid errors and rejects cross-origin requests", async () => {
    expect(
      (
        await POST(
          request({
            token: "x",
            newPassword: "short",
            confirmPassword: "short",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request(
            {
              token: "x",
              newPassword: "correct horse 2026",
              confirmPassword: "correct horse 2026",
            },
            false,
          ),
        )
      ).status,
    ).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  it("clears the session cookie only after successful reset", async () => {
    execute.mockResolvedValue({ ok: true, userId: "user" });
    const response = await POST(
      request({
        token: "opaque",
        newPassword: "correct horse 2026",
        confirmPassword: "correct horse 2026",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.getSetCookie()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/smarthire\.session=;.*Path=\/.*Max-Age=0/i),
        expect.stringMatching(
          /smarthire\.pre-auth=;.*Path=\/api\/identity\/two-factor\/complete.*Max-Age=0/i,
        ),
      ]),
    );
    expect(await response.json()).toEqual({
      message: "Your password has been reset. Sign in again.",
    });
  });

  it("returns 503 fail-closed and clears matching auth cookies for retryable cleanup", async () => {
    execute.mockResolvedValue({
      ok: false,
      retryable: true,
      message: "Your password reset could not be completed. Please try again.",
    });
    const response = await POST(
      request({
        token: "opaque",
        newPassword: "correct horse 2026",
        confirmPassword: "correct horse 2026",
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(await response.json()).toEqual({
      message: "Your password reset could not be completed. Please try again.",
    });
  });
});
