import { describe, expect, it } from "vitest";
import { classifyOrigin, configuredOrigins } from "@/backend/admin/origins";

const environment = {
  NODE_ENV: "test",
  APP_ENV: "test",
  CANDIDATE_ORIGIN: "http://localhost:3001",
  ADMIN_ORIGIN: "http://console.admin.localhost:3001",
  RECRUITER_ORIGIN: "http://console.recruiter.localhost:3001",
  ADMIN_EVIDENCE_STORAGE_ADAPTER: "filesystem",
  ADMIN_EVIDENCE_STORAGE_ROOT: "D:/test/admin-evidence",
} as const;

describe("exact product origins", () => {
  it("recognizes only the three configured exact origins", () => {
    expect(configuredOrigins(environment)).toEqual({
      candidate: "http://localhost:3001",
      admin: "http://console.admin.localhost:3001",
      recruiter: "http://console.recruiter.localhost:3001",
    });
    expect(
      classifyOrigin("http://console.admin.localhost:3001", environment),
    ).toBe("admin");
    expect(
      classifyOrigin("http://evil.console.admin.localhost:3001", environment),
    ).toBeNull();
  });

  it("rejects duplicate origins at startup", () => {
    expect(() =>
      configuredOrigins({
        ...environment,
        RECRUITER_ORIGIN: environment.ADMIN_ORIGIN,
      }),
    ).toThrow();
  });
});
