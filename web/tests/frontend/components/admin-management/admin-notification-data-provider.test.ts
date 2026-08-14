import { afterEach, describe, expect, it, vi } from "vitest";
import { adminAuthProvider } from "@/frontend/features/admin/app/auth-provider";
import { adminDataProvider } from "@/frontend/features/admin/app/data-provider";

function response(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("admin notification data provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves unread metadata from the administrator list endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          data: [],
          total: 0,
          meta: {
            unreadCount: 3,
            observedAt: "2026-08-14T00:00:00.000Z",
          },
        }),
      ),
    );

    const result = await adminDataProvider.getList("notifications", {
      pagination: { page: 1, perPage: 8 },
      sort: { field: "lastOccurredAt", order: "DESC" },
      filter: { state: "all" },
    });

    expect(result.meta).toEqual(expect.objectContaining({ unreadCount: 3 }));
  });

  it("uses the administrator endpoint and CSRF proof for read mutations", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({ accountId: "admin-1", csrfToken: "admin-csrf-proof" }),
      )
      .mockResolvedValueOnce(
        response({
          changedCount: 1,
          unreadCount: 0,
          observedAt: "2026-08-14T00:00:00.000Z",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    await adminAuthProvider.checkAuth?.({});

    await adminDataProvider.update("notifications", {
      id: "notification-1",
      data: { readAt: "2026-08-14T00:00:00.000Z" },
      previousData: { id: "notification-1", readAt: null },
    });

    const [path, init] = fetch.mock.calls[1] as [string, RequestInit];
    expect(path).toBe("/api/admin/notifications/notification-1/read");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("x-csrf-token")).toBe(
      "admin-csrf-proof",
    );
  });
});
