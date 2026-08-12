import { describe, expect, it } from "vitest";
import {
  decodeConversationCursor,
  encodeConversationCursor,
} from "@/backend/repositories/messaging/prisma-messaging-conversation-repository";

describe("messaging history/read pagination invariants", () => {
  it("round-trips an equal-time list cursor with an id tie-breaker", () => {
    const cursor = {
      lastMessageAt: "2026-08-11T00:00:00.000Z",
      id: "conversation-b",
    };
    expect(decodeConversationCursor(encodeConversationCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed list cursors without exposing decoder internals", () => {
    expect(decodeConversationCursor("not-valid-json")).toBeNull();
  });

  it("models monotonic read boundaries for repeated and stale requests", () => {
    const advance = (current: number, requested: number, maximum: number) => {
      if (requested > maximum) throw new Error("READ_SEQUENCE_CONFLICT");
      return Math.max(current, requested);
    };
    expect(advance(4, 4, 10)).toBe(4);
    expect(advance(4, 2, 10)).toBe(4);
    expect(advance(4, 8, 10)).toBe(8);
    expect(() => advance(4, 11, 10)).toThrow("READ_SEQUENCE_CONFLICT");
  });
});
