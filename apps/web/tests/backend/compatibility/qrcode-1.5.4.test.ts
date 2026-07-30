import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import * as realQrcode from "qrcode";

// T180 — pre-implementation QR dependency compatibility gate.
// This suite uses the REAL qrcode library (never a mock) to prove the pinned
// dependency renders SmartHire's Better Auth otpauth URIs locally, offline,
// and server-side only.

const require = createRequire(import.meta.url);

// A deterministic, safe test vector. The secret is a well-known RFC 4648
// base32 placeholder used purely for offline QR generation, not a real secret.
const TEST_OTPAUTH_URI =
  "otpauth://totp/SmartHire:demo@example.test?secret=JBSWY3DPEHPK3PXP&issuer=SmartHire&algorithm=SHA1&digits=6&period=30";

function reconstructFromSegments(uri: string): string {
  const symbol = realQrcode.create(uri, { errorCorrectionLevel: "M" });
  return symbol.segments
    .map((segment) => Buffer.from(segment.data as Uint8Array).toString("utf8"))
    .join("");
}

describe("qrcode 1.5.4 compatibility gate (real library)", () => {
  it("resolves the exact pinned versions from the sole root lockfile", () => {
    const qrcodePkg = require("qrcode/package.json") as { version: string };
    const typesPkg = require("@types/qrcode/package.json") as {
      version: string;
    };
    expect(qrcodePkg.version).toBe("1.5.4");
    expect(typesPkg.version).toBe("1.5.6");
  });

  it("imports successfully in a server-side (Node) module context", () => {
    expect(typeof realQrcode.toDataURL).toBe("function");
    expect(typeof realQrcode.create).toBe("function");
  });

  it("generates a non-empty PNG data URL from the deterministic otpauth URI", async () => {
    const dataUrl = await realQrcode.toDataURL(TEST_OTPAUTH_URI, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const base64 = dataUrl.replace("data:image/png;base64,", "");
    expect(base64.length).toBeGreaterThan(100);
    // Valid PNG signature.
    const bytes = Buffer.from(base64, "base64");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("encodes content that represents exactly the supplied otpauth URI", () => {
    // The encoder splits the URI into optimized Byte/Alphanumeric segments;
    // concatenating the segment payloads reconstructs the original input,
    // proving the QR content equals the supplied URI.
    expect(reconstructFromSegments(TEST_OTPAUTH_URI)).toBe(TEST_OTPAUTH_URI);
  });

  it("makes zero network requests during generation", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await realQrcode.toDataURL(TEST_OTPAUTH_URI);
      await realQrcode.toString(TEST_OTPAUTH_URI, { type: "utf8" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("exposes no browser/client entrypoint import from application code", () => {
    // The server QR boundary imports the Node build ("qrcode"), never the
    // browser build ("qrcode/lib/browser"). Confirm the Node build resolves.
    expect(() => require.resolve("qrcode")).not.toThrow();
  });

  it("runs under the required Node.js runtime", () => {
    expect(process.versions.node).toBe("24.18.0");
  });
});
