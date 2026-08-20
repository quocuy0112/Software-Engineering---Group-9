import { afterEach, describe, expect, it, vi } from "vitest";
import {
  adminAuthProvider,
  currentAdminCsrfToken,
} from "@/frontend/features/admin/app/auth-provider";

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("admin auth provider signed-out behavior", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deduplicates concurrent context reads and returns no signed-out permissions", async () => {
    const fetch = vi.fn(async () => response(401, { code: "UNAUTHORIZED" }));
    vi.stubGlobal("fetch", fetch);

    const auth = adminAuthProvider.checkAuth?.({});
    const permissions = adminAuthProvider.getPermissions?.({});
    await expect(auth).rejects.toMatchObject({ status: 401 });
    await expect(permissions).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(currentAdminCsrfToken()).toBeNull();
  });

  it("makes automatic logout idempotent after an unauthorized context", async () => {
    const fetch = vi.fn(async () => response(401, { code: "UNAUTHORIZED" }));
    vi.stubGlobal("fetch", fetch);

    await expect(adminAuthProvider.checkAuth?.({})).rejects.toMatchObject({
      status: 401,
    });
    await expect(adminAuthProvider.logout?.({})).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("swallows an expired-session response during an explicit logout", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response(200, {
          accountId: "admin-1",
          displayName: "Administrator",
          csrfToken: "csrf-proof",
        }),
      )
      .mockResolvedValueOnce(response(401, { code: "UNAUTHORIZED" }));
    vi.stubGlobal("fetch", fetch);

    await expect(adminAuthProvider.checkAuth?.({})).resolves.toBeUndefined();
    expect(currentAdminCsrfToken()).toBe("csrf-proof");
    await expect(adminAuthProvider.logout?.({})).resolves.toBeUndefined();
    expect(currentAdminCsrfToken()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps an authenticated admin session for a step-up challenge", async () => {
    const fetch = vi.fn(async () =>
      response(200, {
        accountId: "admin-1",
        displayName: "Administrator",
        csrfToken: "csrf-proof",
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(adminAuthProvider.checkAuth?.({})).resolves.toBeUndefined();
    await expect(
      adminAuthProvider.checkError?.({
        status: 403,
        code: "STEP_UP_REQUIRED",
        body: { code: "STEP_UP_REQUIRED" },
      }),
    ).resolves.toBeUndefined();
    expect(currentAdminCsrfToken()).toBe("csrf-proof");
  });
});
