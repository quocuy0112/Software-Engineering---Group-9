import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { ClamAvScanner } from "@/backend/cv/scanning/clamav";

const cleanBytes = Buffer.from("synthetic clean bytes");
const eicar = Buffer.from(
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
);

function scanner(response: string, options?: { now?: Date; delayMs?: number }) {
  const frames: Buffer[] = [];
  const transport = vi.fn(async (chunks: AsyncIterable<Uint8Array>) => {
    for await (const chunk of chunks) frames.push(Buffer.from(chunk));
    if (options?.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    return response;
  });
  return {
    scanner: new ClamAvScanner({
      socketPath: "/run/clamav/clamd.sock",
      timeoutMs: 20_000,
      maximumBytes: 6 * 1024 * 1024,
      now: () => options?.now ?? new Date("2026-08-01T12:00:00.000Z"),
      transport,
      readiness: async () => ({
        version: "ClamAV 1.4.5/fixture/Fri Jul 31 13:00:00 2026 GMT",
      }),
    }),
    frames,
    transport,
  };
}

describe("ClamAV isolated scan adapter", () => {
  it("uses Unix-only bounded INSTREAM framing for one clean assessment", async () => {
    const fixture = scanner("stream: OK\0");
    await expect(
      fixture.scanner.scan(Readable.from([cleanBytes])),
    ).resolves.toEqual({
      outcome: "CLEAN",
      engineVersion: "1.4.5",
    });
    expect(fixture.transport).toHaveBeenCalledOnce();
    expect(Buffer.concat(fixture.frames).subarray(0, 10).toString()).toBe(
      "zINSTREAM\0",
    );
    expect(Buffer.concat(fixture.frames).subarray(-4)).toEqual(Buffer.alloc(4));
  });

  it("maps EICAR without returning raw clamd text or filenames", async () => {
    const fixture = scanner("stream: Eicar-Signature FOUND\0");
    const result = await fixture.scanner.scan(Readable.from([eicar]));
    expect(result).toEqual({
      outcome: "INFECTED",
      threatCode: "MALWARE_DETECTED",
    });
    expect(JSON.stringify(result)).not.toContain("Eicar-Signature");
  });

  it.each([
    ["unavailable", "CV_SCANNER_UNAVAILABLE"],
    ["stale signatures", "CV_SCANNER_DEFINITIONS_STALE"],
    ["timeout", "CV_SCANNER_TIMEOUT"],
  ])("fails closed for %s", async (kind, code) => {
    const fixture = scanner("stream: OK\0");
    if (kind === "unavailable")
      fixture.transport.mockRejectedValueOnce(new Error("raw socket path"));
    if (kind === "stale signatures") {
      fixture.scanner.setReadinessForTest(async () => ({
        version: "ClamAV 1.4.5/fixture/Thu Jul 30 00:00:00 2026 GMT",
      }));
    }
    if (kind === "timeout") fixture.scanner.setTimeoutForTest(1);
    await expect(
      fixture.scanner.scan(Readable.from([cleanBytes])),
    ).rejects.toMatchObject({
      code,
    });
  });

  it("rejects TCP configuration and over-6-MiB streams before parsing can run", async () => {
    expect(
      () =>
        new ClamAvScanner({
          socketPath: "tcp://clamav:3310",
          transport: async () => "stream: OK\0",
        }),
    ).toThrow("CV_SCANNER_CONFIGURATION_INVALID");
    const fixture = scanner("stream: OK\0");
    await expect(
      fixture.scanner.scan(Readable.from([Buffer.alloc(6 * 1024 * 1024 + 1)])),
    ).rejects.toMatchObject({ code: "CV_SCANNER_STREAM_LIMIT" });
  });
});
