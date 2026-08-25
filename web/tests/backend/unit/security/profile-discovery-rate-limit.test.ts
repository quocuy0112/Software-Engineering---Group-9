import { describe, expect, it } from "vitest";
import { rateLimitPolicies } from "@/backend/security/rate-limit/policies";

describe("profile discovery rate-limit policy", () => {
  it("uses separate account and network admission windows", () => {
    expect(rateLimitPolicies.profileDiscoveryAccount).toMatchObject({ limit: 10, windowSeconds: 60 });
    expect(rateLimitPolicies.profileDiscoveryNetwork).toMatchObject({ limit: 10, windowSeconds: 60 });
    expect(rateLimitPolicies.profileDiscoveryAccount.scope).not.toBe(rateLimitPolicies.profileDiscoveryNetwork.scope);
  });
  it("keeps failed lookup counters on a rolling one-hour policy", () => {
    expect(rateLimitPolicies.profileDiscoveryFailuresAccount).toMatchObject({ limit: 30, windowSeconds: 3600 });
    expect(rateLimitPolicies.profileDiscoveryFailuresNetwork).toMatchObject({ limit: 30, windowSeconds: 3600 });
  });
});
