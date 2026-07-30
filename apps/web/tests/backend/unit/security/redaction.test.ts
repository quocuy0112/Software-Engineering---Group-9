import { describe, expect, it } from "vitest";
import { redactText, redactUnknown } from "@/backend/security/redaction";

describe("secret redaction", () => {
  it("removes secret fields, bearer values, token URLs, OTPs, and backup codes", () => {
    const result = JSON.stringify(
      redactUnknown({
        password: "hidden",
        cookie: "session=x",
        nested: {
          url: "https://example.test/?token=raw",
          note: "Bearer abc 123456 ABCD-EFGH-IJKL",
        },
      }),
    );
    expect(result).not.toMatch(
      /hidden|session=x|token=raw|Bearer abc|123456|ABCD-EFGH-IJKL/,
    );
    expect(redactText("https://example.test/?token=raw")).not.toContain("raw");
  });
  it.each([
    "password=hunter2",
    "Cookie: smarthire.session=opaque",
    "Authorization: Bearer abc.def",
    "?token=raw-value",
    "123456",
    "ABCD-EFGH-IJKL",
    "SMTP_PASSWORD=app-secret",
  ])("redacts prohibited corpus entry", (value) =>
    expect(redactText(value)).not.toContain(value.split(/[=: ]/).at(-1)),
  );
});
