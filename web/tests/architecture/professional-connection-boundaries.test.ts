import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("professional connection privacy boundaries", () => {
  const repository = readFileSync(
    "src/backend/repositories/connections/prisma-connection-repository.ts",
    "utf8",
  );
  const gateway = readFileSync(
    "src/backend/connections/realtime/socket-io-connection-gateway.ts",
    "utf8",
  );
  it("does not query private message content or copy support content", () => {
    expect(repository).not.toContain("messagingMessage");
    expect(repository).not.toContain("SupportMessage");
    expect(repository).not.toContain("supportMessage");
  });
  it("publishes only content-free invalidation fields", () => {
    expect(gateway).not.toContain("reason");
    expect(gateway).not.toContain("email");
    expect(gateway).not.toContain("decisionKind");
  });
});
