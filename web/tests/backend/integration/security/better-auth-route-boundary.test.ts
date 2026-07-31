import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/auth/[...all]/route";
import { auth } from "@/backend/auth/cookies/config";

describe("Better Auth provider route boundary", () => {
  it.each([
    ["GET", "/api/auth/get-session", GET],
    ["POST", "/api/auth/sign-in/email", POST],
    ["POST", "/api/auth/sign-up/email", POST],
    ["POST", "/api/auth/revoke-sessions", POST],
  ] as const)("hides public %s %s", async (_method, path, handler) => {
    const response = handler(
      new Request(`http://localhost:3001${path}`, { method: _method }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ message: "Not found." });
  });

  it("disables provider-native sign-up even for internal handler calls", async () => {
    const context = await auth.$context;
    expect(context.options.emailAndPassword?.disableSignUp).toBe(true);
  });
});
