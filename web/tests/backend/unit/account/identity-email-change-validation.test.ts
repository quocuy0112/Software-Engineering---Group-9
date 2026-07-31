import { describe, expect, it } from "vitest";
import {
  normalizeAccountName,
  normalizeIdentityEmail,
} from "@/backend/services/account/account-identity-service";
import {
  emailChangeRequestBinding,
  normalizeProposedEmail,
} from "@/shared/contracts/account/email-change";
import {
  EMAIL_CHANGE_PROOF_TTL_MS,
  EmailChangeProofProtector,
} from "@/backend/security/email-change-proof";

describe("identity and email-change validation", () => {
  it("NFKC-normalizes and sanitizes a 1-150 code-point full name", () => {
    expect(normalizeAccountName("  Ｎguyễn <b>Văn</b> An  ")).toEqual({
      name: "Nguyễn Văn An",
      warnings: [],
    });
    expect(() => normalizeAccountName("<script>alert(1)</script>")).toThrow(
      /name|plain_text|required/i,
    );
    expect(() => normalizeAccountName("a".repeat(151))).toThrow(
      /name|plain_text|long/i,
    );
  });

  it("separates canonical display email from its comparison key", () => {
    expect(normalizeIdentityEmail("  New.User@Example.TEST  ")).toEqual({
      displayEmail: "New.User@Example.TEST",
      normalizedEmail: "new.user@example.test",
    });
    expect(normalizeProposedEmail("Ｎew.User@Example.TEST")).toEqual({
      displayEmail: "New.User@Example.TEST",
      normalizedEmail: "new.user@example.test",
    });
    expect(() => normalizeProposedEmail("not-an-email")).toThrow();
  });

  it("binds idempotency replays to normalized-equivalent submissions", () => {
    expect(emailChangeRequestBinding(" New@Example.test ")).toBe(
      emailChangeRequestBinding("new@example.TEST"),
    );
    expect(emailChangeRequestBinding("other@example.test")).not.toBe(
      emailChangeRequestBinding("new@example.test"),
    );
  });

  it("uses purpose-separated opaque proof digests, sealing, and a 30-minute edge", () => {
    const protector = new EmailChangeProofProtector("s".repeat(64));
    const proof = protector.generate();
    const digest = protector.digest(proof);
    const sealed = protector.seal(proof);
    const now = new Date("2026-07-31T00:00:00.000Z");
    expect(proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(proof);
    expect(sealed).not.toContain(proof);
    expect(protector.unseal(sealed)).toBe(proof);
    expect(protector.expiresAt(now).getTime() - now.getTime()).toBe(
      EMAIL_CHANGE_PROOF_TTL_MS,
    );
    expect(protector.isExpired(protector.expiresAt(now), now)).toBe(false);
    expect(
      protector.isExpired(
        protector.expiresAt(now),
        new Date(now.getTime() + EMAIL_CHANGE_PROOF_TTL_MS),
      ),
    ).toBe(true);
  });

  it("builds a fragment-only link and never places proof in search params", () => {
    const protector = new EmailChangeProofProtector("s".repeat(64));
    const proof = protector.generate();
    const url = new URL(
      protector.fragmentUrl(proof, "https://smarthire.example"),
    );
    expect(url.pathname).toBe("/verify-email-change");
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#proof=${encodeURIComponent(proof)}`);
  });
});
