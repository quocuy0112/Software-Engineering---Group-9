import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";

describe("/verify-email-change response headers", () => {
  it("combines the global security policy with page-level no-store", async () => {
    const entries = await nextConfig.headers?.();
    expect(entries).toBeDefined();
    const global = entries?.find((entry) => entry.source === "/:path*");
    const page = entries?.find(
      (entry) => entry.source === "/verify-email-change",
    );
    expect(page?.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "no-store, max-age=0" },
      ]),
    );
    expect(global?.headers).toEqual(
      expect.arrayContaining([
        { key: "Referrer-Policy", value: "no-referrer" },
        expect.objectContaining({
          key: "Content-Security-Policy",
          value: expect.stringContaining("frame-ancestors 'none'"),
        }),
      ]),
    );
  });
});
