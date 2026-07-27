import { describe, expect, it } from "vitest";
import {
  ACCOUNT_RECOVERY_CAPABILITY_PATH,
  clearAccountRecoveryCapability,
  issueAccountRecoveryCapability,
  readAccountRecoveryCapability,
} from "@/lib/security/account-recovery-capability";

const now = new Date("2026-07-27T10:00:00.000Z");
const proof = "route-proof".padEnd(40, "x");

function requestHeaders(setCookie: string) {
  return new Headers({ cookie: setCookie.split(";")[0] });
}

describe("account recovery route capability", () => {
  it("round-trips an encrypted, kind-bound, short-lived proof", () => {
    const cookie = issueAccountRecoveryCapability("confirmation", proof, now);
    expect(cookie).toContain(`Path=${ACCOUNT_RECOVERY_CAPABILITY_PATH}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=300");
    expect(cookie).not.toContain(proof);
    expect(
      readAccountRecoveryCapability(
        requestHeaders(cookie),
        "confirmation",
        now,
      ),
    ).toEqual({ kind: "confirmation", proof });
    expect(
      readAccountRecoveryCapability(requestHeaders(cookie), "completion", now),
    ).toBeNull();
  });

  it("rejects expired and tampered cookies", () => {
    const cookie = issueAccountRecoveryCapability("confirmation", proof, now);
    expect(
      readAccountRecoveryCapability(
        requestHeaders(cookie),
        "confirmation",
        new Date(now.getTime() + 301_000),
      ),
    ).toBeNull();
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = decodeURIComponent(pair.slice(separator + 1));
    const ciphertextStart = value.lastIndexOf(".") + 1;
    const replacement = value[ciphertextStart] === "a" ? "b" : "a";
    const tamperedValue = `${value.slice(0, ciphertextStart)}${replacement}${value.slice(ciphertextStart + 1)}`;
    const tampered = `${name}=${encodeURIComponent(tamperedValue)}`;
    expect(
      readAccountRecoveryCapability(
        new Headers({ cookie: tampered }),
        "confirmation",
        now,
      ),
    ).toBeNull();
  });

  it("clears the exact route-scoped cookie", () => {
    const cleared = clearAccountRecoveryCapability();
    expect(cleared).toContain(`Path=${ACCOUNT_RECOVERY_CAPABILITY_PATH}`);
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("SameSite=Strict");
    expect(cleared).toContain("Max-Age=0");
  });
});
