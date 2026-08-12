import { describe, expect, it } from "vitest";
import { isCandidateHost } from "@/backend/auth/candidate-host-boundary";

describe("candidate host boundary", () => {
  const candidate = "https://candidate.example.test";

  it.each(["candidate.example.test", "CANDIDATE.EXAMPLE.TEST"])(
    "accepts exact normalized host %s",
    (host) => {
      expect(isCandidateHost(host, candidate)).toBe(true);
    },
  );

  it.each([
    null,
    "",
    "candidate.example.test, attacker.example.test",
    "admin.example.test",
    "recruiter.example.test",
    "not a host",
    "https://candidate.example.test/path",
  ])("rejects unsafe host %s", (host) => {
    expect(isCandidateHost(host, candidate)).toBe(false);
  });
});
