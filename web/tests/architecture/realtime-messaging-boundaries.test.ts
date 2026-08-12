import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readIfPresent = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
};

describe("Feature 008 architecture boundaries", () => {
  it("uses one browser session and one application database", () => {
    const sources = globSync("src/**/*.{ts,tsx}")
      .filter((path) => path.includes("messaging") || path.endsWith("server.ts"))
      .map(readIfPresent)
      .join("\n");
    expect(sources).not.toMatch(/localStorage|sessionStorage|auth:\s*\{\s*token/iu);
    expect(sources).not.toMatch(/jsonwebtoken|new\s+Kafka|RabbitMQ|RedisAdapter/iu);
  });

  it("keeps post-MVP capabilities outside executable messaging paths", () => {
    const sources = globSync("src/**/*.{ts,tsx}")
      .filter((path) => path.includes("messaging"))
      .map(readIfPresent)
      .join("\n");
    expect(sources).not.toMatch(/typing:|group:|voiceCall|videoCall|attachmentUpload|messageSearch|exportChat|pinConversation/iu);
    expect(sources).not.toMatch(/from\s+["']@mui|from\s+["'][^"']*(?:template|messenger-clone)/iu);
  });

  it("keeps REST endpoints in Route Handlers", () => {
    const plan = readIfPresent(
      "../spec-kit/specs/008-realtime-messaging/plan.md",
    );
    expect(plan).toContain("/api/messaging/**");
    expect(plan).toMatch(/custom(?:-| )server entrypoint/iu);
  });

  it("keeps one process/database and contains no broker or per-message receipt model", () => {
    const packageSource = readIfPresent("package.json");
    const schema = readIfPresent("prisma/schema.prisma");
    const server = readIfPresent("server.ts");
    expect(server).toContain("attachSocketIoChatGateway(server)");
    expect(packageSource).not.toMatch(/kafka|rabbitmq|redis/iu);
    expect(schema).not.toMatch(/model\s+(?:ReadReceipt|MessageReceipt)/u);
    expect(schema.match(/datasource\s+db\s*\{/gu)).toHaveLength(1);
  });

  it("keeps socket credentials in the existing HttpOnly session handshake", () => {
    const client = readIfPresent("src/frontend/features/messaging/client/chat-socket.ts");
    expect(client).toContain('withCredentials: true');
    expect(client).not.toMatch(/jwt|bearer|token/iu);
  });
});
