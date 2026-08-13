import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  INTERNAL_ADMIN_ROUTE,
  INTERNAL_RECRUITER_ROUTE,
  INTERNAL_SHELL_HEADER,
  proxy,
} from "@/proxy";

function request(url: string) {
  const target = new URL(url);
  return new NextRequest(target, { headers: { host: target.host } });
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

  it("does not expose either internal shell route directly", () => {
    for (const url of [
      `http://localhost:3001${INTERNAL_ADMIN_ROUTE}`,
      `http://localhost:3001${INTERNAL_RECRUITER_ROUTE}`,
      `http://console.admin.localhost:3001${INTERNAL_ADMIN_ROUTE}`,
      `http://console.recruiter.localhost:3001${INTERNAL_RECRUITER_ROUTE}`,
    ]) {
      expect(proxy(request(url)).status, url).toBe(404);
    }
  });

  it("allows only server-routed internal product shells", () => {
    const admin = new NextRequest(
      `http://console.admin.localhost:3001${INTERNAL_ADMIN_ROUTE}`,
      {
        headers: {
          host: "console.admin.localhost:3001",
          [INTERNAL_SHELL_HEADER]: "admin",
        },
      },
    );
    const recruiter = new NextRequest(
      `http://console.recruiter.localhost:3001${INTERNAL_RECRUITER_ROUTE}`,
      {
        headers: {
          host: "console.recruiter.localhost:3001",
          [INTERNAL_SHELL_HEADER]: "recruiter",
        },
      },
    );

    expect(proxy(admin).headers.get("x-middleware-next")).toBe("1");
    expect(proxy(recruiter).headers.get("x-middleware-next")).toBe("1");
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
