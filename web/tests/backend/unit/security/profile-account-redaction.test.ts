import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { authenticationAuditEventSchema } from "@/backend/audit/events";
import {
  REDACTED,
  redactText,
  redactUnknown,
  safeErrorCode,
} from "@/backend/security/redaction";

async function sourceFiles(root: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(root, { withFileTypes: true })).map((entry) => {
        const path = join(root, entry.name);
        return entry.isDirectory()
          ? sourceFiles(path)
          : Promise.resolve([path]);
      }),
    )
  ).flat();
}

const forbiddenValues = {
  currentPassword: "Current-Passphrase-002!",
  newPassword: "Replacement-Passphrase-002!",
  proof: "email-change-proof-raw-002",
  verificationLink:
    "https://app.example.test/verify-email-change#proof=email-change-proof-raw-002",
  recipient: "private-candidate-002@example.test",
  cookie: "smarthire.session=opaque-cookie-002",
  sessionId: "session-private-002",
  csrfToken: "csrf-private-002",
  rawHeaders: "x-forwarded-for: 203.0.113.42; cookie: opaque-cookie-002",
  profileBody: '{"summary":"private profile body 002"}',
  providerError: "SMTP provider exposed private-candidate-002@example.test",
  databaseError: "P2002 value private-candidate-002@example.test",
} as const;

describe("Feature 002 secret and privacy regression", () => {
  it("redacts every prohibited structured value at nested boundaries", () => {
    const redacted = JSON.stringify(
      redactUnknown({
        passwordChange: {
          currentPassword: forbiddenValues.currentPassword,
          newPassword: forbiddenValues.newPassword,
        },
        emailChange: {
          proof: forbiddenValues.proof,
          verificationLink: forbiddenValues.verificationLink,
          recipient: forbiddenValues.recipient,
        },
        request: {
          cookie: forbiddenValues.cookie,
          sessionId: forbiddenValues.sessionId,
          csrfToken: forbiddenValues.csrfToken,
          rawHeaders: forbiddenValues.rawHeaders,
          profileBody: forbiddenValues.profileBody,
        },
        failures: {
          providerError: forbiddenValues.providerError,
          databaseError: forbiddenValues.databaseError,
        },
      }),
    );
    for (const secret of Object.values(forbiddenValues)) {
      expect(redacted).not.toContain(secret);
    }
    expect(redacted).toContain(REDACTED);
  });

  it("redacts labeled text and full fragment-based verification links", () => {
    const messages = [
      `password=${forbiddenValues.currentPassword}`,
      `proof=${forbiddenValues.proof}`,
      `verificationLink=${forbiddenValues.verificationLink}`,
      `recipient=${forbiddenValues.recipient}`,
      `Cookie: ${forbiddenValues.cookie}`,
      `sessionId=${forbiddenValues.sessionId}`,
      `csrf=${forbiddenValues.csrfToken}`,
      `rawHeaders=${JSON.stringify(forbiddenValues.rawHeaders)}`,
      `profileBody=${forbiddenValues.profileBody}`,
    ];
    for (const message of messages) {
      const redacted = redactText(message);
      expect(redacted, message).toContain(REDACTED);
      expect(redacted, message).not.toContain(
        message.slice(message.indexOf("=") + 1),
      );
    }
    expect(redactText(forbiddenValues.verificationLink)).not.toContain(
      forbiddenValues.proof,
    );
  });

  it("allows only bounded machine error codes across provider/database boundaries", () => {
    expect(safeErrorCode({ code: "SMTP_CONNECTION_TIMEOUT" })).toBe(
      "SMTP_CONNECTION_TIMEOUT",
    );
    expect(safeErrorCode({ code: "P2002" })).toBe("P2002");
    for (const code of [
      forbiddenValues.providerError,
      forbiddenValues.databaseError,
      "provider_error=candidate@example.test",
      "lowercase-internal-detail",
      "A".repeat(81),
    ]) {
      expect(safeErrorCode({ code })).toBe("INTERNAL_ERROR");
    }
    expect(safeErrorCode(new Error(forbiddenValues.providerError))).toBe(
      "INTERNAL_ERROR",
    );
  });

  it("keeps durable audit context on a strict non-secret allowlist", () => {
    const base = {
      occurredAt: new Date(),
      actorType: "user" as const,
      actorUserId: "user-reference",
      actorSessionId: "session-reference",
      action: "password_change.failed" as const,
      targetType: "password_change" as const,
      targetId: "operation-reference",
      result: "FAILURE" as const,
      correlationId: "correlation-002",
      context: { failureCode: "PASSWORD_CHANGE_INCOMPLETE" },
    };
    expect(authenticationAuditEventSchema.safeParse(base).success).toBe(true);
    for (const [key, value] of Object.entries(forbiddenValues)) {
      expect(
        authenticationAuditEventSchema.safeParse({
          ...base,
          context: { ...base.context, [key]: value },
        }).success,
        key,
      ).toBe(false);
    }
  });

  it("contains no direct logging in Feature 002 services, repositories, or routes", async () => {
    const roots = [
      "src/backend/services/account",
      "src/backend/repositories/account",
      "src/app/api/account",
    ];
    for (const root of roots) {
      for (const path of await sourceFiles(root)) {
        if (![".ts", ".tsx"].includes(extname(path))) continue;
        const source = await readFile(path, "utf8");
        expect(source, path).not.toMatch(
          /\bconsole\.(?:debug|info|log|warn|error)\s*\(/u,
        );
      }
    }
  });
});
