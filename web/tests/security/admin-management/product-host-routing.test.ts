import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { INTERNAL_ADMIN_ROUTE, INTERNAL_RECRUITER_ROUTE, proxy } from "@/proxy";

function request(url: string, headers?: HeadersInit) {
  const target = new URL(url);
  return new NextRequest(target, {
    headers: { host: target.host, ...headers },
  });
}

describe("product host shell routing", () => {
  it("rewrites the exact admin and recruiter hosts to routable segments", () => {
    const admin = proxy(
      request("http://console.admin.localhost:3001/accounts"),
    );
    const recruiter = proxy(
      request("http://console.recruiter.localhost:3001/"),
    );

    expect(admin.headers.get("x-middleware-rewrite")).toBe(
      `http://console.admin.localhost:3001${INTERNAL_ADMIN_ROUTE}/accounts`,
    );
    expect(recruiter.headers.get("x-middleware-rewrite")).toBe(
      `http://console.recruiter.localhost:3001${INTERNAL_RECRUITER_ROUTE}`,
    );
  });

  it("redirects the user-facing admin alias without exposing the internal shell", () => {
    const candidateAlias = proxy(
      request(`http://localhost:3001${INTERNAL_ADMIN_ROUTE}/accounts`),
    );

    expect(candidateAlias.status).toBe(307);
    expect(candidateAlias.headers.get("location")).toBe(
      "http://console.admin.localhost:3001/accounts",
    );
    expect(
      proxy(
        request(`http://console.admin.localhost:3001${INTERNAL_ADMIN_ROUTE}`),
      ).status,
    ).toBe(404);
    expect(
      proxy(
        request(
          `http://console.recruiter.localhost:3001${INTERNAL_RECRUITER_ROUTE}`,
        ),
      ).status,
    ).toBe(404);
    expect(
      proxy(
        request(`http://localhost:3001${INTERNAL_ADMIN_ROUTE}`, {
          "x-smarthire-internal-admin-shell": "1",
        }),
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });

  it("leaves candidate pages and APIs to their authoritative handlers", () => {
    expect(
      proxy(request("http://localhost:3001/jobs")).headers.get(
        "x-middleware-next",
      ),
    ).toBe("1");
    expect(
      proxy(
        request("http://console.admin.localhost:3001/api/admin/dashboard"),
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  });
});
