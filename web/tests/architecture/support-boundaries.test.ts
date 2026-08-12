import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Support Center architecture boundaries", () => {
  it("keeps support persistence separate from ordinary messaging repositories", () => {
    const supportSources = globSync(
      "src/backend/{support,repositories/support}/**/*.ts",
    )
      .map(read)
      .join("\n");
    expect(supportSources).not.toMatch(
      /repositories\/messaging|messagingConversation|messagingMessage/iu,
    );
  });

  it("keeps requester and realtime contracts free of administrator identity and notes", () => {
    const contracts = read("src/shared/contracts/support/index.ts");
    const requesterContract = contracts.slice(
      contracts.indexOf("export const supportMessageSchema"),
      contracts.indexOf("export const adminSupportCaseSummarySchema"),
    );
    const realtimeContract = contracts.slice(
      contracts.indexOf("export const supportInvalidationSchema"),
      contracts.indexOf("export type SupportCategory"),
    );
    expect(requesterContract).not.toMatch(
      /adminUserId|assignee|internalNote/iu,
    );
    expect(realtimeContract).not.toMatch(
      /content|message|note|adminUserId|assignee/iu,
    );
  });

  it("uses a distinct support namespace without modifying chat authorization", () => {
    const supportGateway = read(
      "src/backend/support/realtime/socket-io-support-gateway.ts",
    );
    const chatGateway = read(
      "src/backend/messaging/realtime/socket-io-chat-gateway.ts",
    );
    expect(supportGateway).toContain('io.of("/support")');
    expect(supportGateway).not.toMatch(
      /conversationRoom|presence:changed|message:new/iu,
    );
    expect(chatGateway).toContain('io.of("/chat")');
  });

  it("keeps support notification payload content-free", () => {
    const repository = read(
      "src/backend/repositories/support/prisma-support-repository.ts",
    );
    const template = read(
      "src/backend/admin/notifications/support-case-template.tsx",
    );
    expect(repository).toContain("payloadRef: { caseId, state, occurredAt:");
    expect(template).toContain("contains no support-message content");
    expect(template).not.toMatch(
      /props\.content|props\.note|administratorName/iu,
    );
  });
});
