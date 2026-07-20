import { describe, expect, it } from "vitest";
import { redactText, redactUnknown } from "@/lib/security/redaction";

describe("secret redaction", () => {
  it("removes secret fields, bearer values, token URLs, OTPs, and backup codes", () => {
    const result = JSON.stringify(redactUnknown({ password: "hidden", cookie: "session=x", nested: { url: "https://example.test/?token=raw", note: "Bearer abc 123456 ABCD-EFGH-IJKL" } }));
    expect(result).not.toMatch(/hidden|session=x|token=raw|Bearer abc|123456|ABCD-EFGH-IJKL/);
    expect(redactText("https://example.test/?token=raw")).not.toContain("raw");
  });
});
