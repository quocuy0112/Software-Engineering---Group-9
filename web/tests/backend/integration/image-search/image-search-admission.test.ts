import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/backend/database/prisma";
import { PrismaImageSearchAdmissionRepository } from "@/backend/repositories/image-search/prisma-image-search-admission-repository";

const repository = new PrismaImageSearchAdmissionRepository();
const created: string[] = [];
const metadata = {
  extension: "png" as const,
  mediaType: "image/png" as const,
  bytes: 100,
  interpreterClass: "DETERMINISTIC_INTERNAL" as const,
  consent: null,
};

function digest(value: number) {
  return Buffer.alloc(32, value);
}

async function admit(input: {
  now: Date;
  browser?: number;
  sourceIp?: number;
  idempotency?: number;
  binding?: number;
}) {
  const result = await repository.admit({
    actor: {
      kind: "VISITOR",
      browserDigest: digest(input.browser ?? 1),
      sourceIpDigest: digest(input.sourceIp ?? 2),
      capability: Buffer.alloc(32, 7).toString("base64url"),
      capabilityHmacKey: digest(8),
      capabilityKeyVersion: 1,
    },
    metadata,
    idempotencyDigest: digest(input.idempotency ?? 3),
    bindingDigest: digest(input.binding ?? 4),
    now: input.now,
  });
  if (result.kind === "ADMITTED") created.push(result.query.id);
  return result;
}

afterEach(async () => {
  if (created.length)
    await prisma.searchImageQuery.deleteMany({
      where: { id: { in: created.splice(0) } },
    });
});

describe.sequential("image-search rolling admission", () => {
  it("replays identical metadata without another quota event and rejects changed bindings", async () => {
    const now = new Date("2026-08-06T04:00:00.000Z");
    const first = await admit({ now });
    const replay = await admit({ now: new Date(now.getTime() + 1_000) });
    expect(first).toMatchObject({ kind: "ADMITTED", replay: false });
    expect(replay).toMatchObject({
      kind: "ADMITTED",
      replay: true,
      query: { id: first.kind === "ADMITTED" ? first.query.id : "" },
    });
    expect(
      await prisma.imageSearchAdmissionEvent.count({
        where: { queryId: first.kind === "ADMITTED" ? first.query.id : "" },
      }),
    ).toBe(2);
    await expect(admit({ now, binding: 9 })).rejects.toThrow(
      "IMAGE_SEARCH_IDEMPOTENCY_KEY_REUSED",
    );
  });

  it("enforces both browser and shared-IP 3/hour windows with the latest retry time", async () => {
    const start = new Date("2026-08-06T05:00:00.000Z");
    for (let index = 0; index < 3; index += 1) {
      const result = await admit({
        now: new Date(start.getTime() + index * 10_000),
        browser: index + 10,
        sourceIp: 20,
        idempotency: index + 30,
        binding: index + 40,
      });
      expect(result.kind).toBe("ADMITTED");
    }
    const limited = await admit({
      now: new Date(start.getTime() + 40_000),
      browser: 99,
      sourceIp: 20,
      idempotency: 90,
      binding: 91,
    });
    expect(limited).toEqual({
      kind: "LIMITED",
      retryAt: new Date(start.getTime() + 60 * 60_000),
    });
    const admittedAfterWindow = await admit({
      now: new Date(start.getTime() + 60 * 60_000 + 1),
      browser: 99,
      sourceIp: 20,
      idempotency: 92,
      binding: 93,
    });
    expect(admittedAfterWindow.kind).toBe("ADMITTED");
  });
});
