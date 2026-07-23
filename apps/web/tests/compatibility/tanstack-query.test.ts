import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

describe("TanStack Query 5.101.4 compatibility boundary", () => {
  it("resolves the exact pin and executes a sanitized mutation", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@tanstack/react-query"]).toBe("5.101.4");

    const client = new QueryClient();
    const mutation = client.getMutationCache().build(client, {
      mutationKey: ["identity", "verification-resend"],
      mutationFn: async () => ({ ok: true as const }),
    });
    await expect(mutation.execute(undefined)).resolves.toEqual({ ok: true });
    expect(client.getQueryData(["identity", "sessions"])).toBeUndefined();
  });

  it("keeps secret-bearing names out of the query boundary source", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/features/identity/client/query-options.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/password|totp|backup.?code|session.?token/i);
    expect(source).toContain('queryKey: ["identity", "sessions"]');
  });
});
