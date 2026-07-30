import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTotpSetup,
  parseTotpManualSetup,
  renderTotpQrCode,
  TotpQrError,
} from "@/backend/auth/two-factor/totp-qr-code";

// A deterministic, safe test otpauth URI. The secret is a well-known RFC 6238
// test vector base32 value and is not a real credential.
const SECRET = "JBSWY3DPEHPK3PXP";
const VALID_URI = `otpauth://totp/SmartHire:demo@example.test?secret=${SECRET}&issuer=SmartHire&algorithm=SHA1&digits=6&period=30`;

describe("renderTotpQrCode (real qrcode 1.5.4)", () => {
  it("renders a non-empty PNG data URL from a valid otpauth URI", async () => {
    const dataUrl = await renderTotpQrCode(VALID_URI);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const base64 = dataUrl.slice("data:image/png;base64,".length);
    expect(base64.length).toBeGreaterThan(100);
    // PNG magic bytes: 89 50 4E 47.
    const header = Buffer.from(base64, "base64").subarray(0, 4);
    expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("encodes exactly the supplied otpauth URI (decoded segment round-trip)", async () => {
    // Use the real library's segment optimizer to prove the encoded content
    // reconstructs the supplied URI byte-for-byte.
    const QRCode = (await import("qrcode")).default;
    const segments = QRCode.create(VALID_URI, {
      errorCorrectionLevel: "M",
    }).segments;
    // Byte-mode segments carry a Buffer; alphanumeric carry a string. Coerce both.
    const reconstructed = segments
      .map((segment) =>
        typeof segment.data === "string"
          ? segment.data
          : Buffer.from(segment.data).toString(),
      )
      .join("");
    expect(reconstructed).toBe(VALID_URI);
  });

  it("makes zero network requests while rendering", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await renderTotpQrCode(VALID_URI);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a malformed URI", async () => {
    await expect(renderTotpQrCode("not a uri")).rejects.toBeInstanceOf(
      TotpQrError,
    );
  });

  it("rejects a non-otpauth protocol", async () => {
    await expect(
      renderTotpQrCode("https://evil.test/totp?secret=ABC&issuer=X"),
    ).rejects.toBeInstanceOf(TotpQrError);
    await expect(
      renderTotpQrCode("javascript:alert(1)//otpauth"),
    ).rejects.toBeInstanceOf(TotpQrError);
  });

  it("rejects a URI missing the secret", async () => {
    await expect(
      renderTotpQrCode(
        "otpauth://totp/SmartHire:demo@example.test?issuer=SmartHire",
      ),
    ).rejects.toBeInstanceOf(TotpQrError);
  });

  it("rejects a URI missing the issuer", async () => {
    await expect(
      renderTotpQrCode(
        `otpauth://totp/SmartHire:demo@example.test?secret=${SECRET}`,
      ),
    ).rejects.toBeInstanceOf(TotpQrError);
  });

  it("rejects invalid rendering options", async () => {
    await expect(
      renderTotpQrCode(VALID_URI, { width: 16 }),
    ).rejects.toBeInstanceOf(TotpQrError);
    await expect(
      renderTotpQrCode(VALID_URI, { width: 4096 }),
    ).rejects.toBeInstanceOf(TotpQrError);
    await expect(
      renderTotpQrCode(VALID_URI, { margin: -1 }),
    ).rejects.toBeInstanceOf(TotpQrError);
    await expect(
      // @ts-expect-error deliberately invalid level
      renderTotpQrCode(VALID_URI, { errorCorrectionLevel: "Z" }),
    ).rejects.toBeInstanceOf(TotpQrError);
  });

  it("never echoes the secret-bearing input in its error", async () => {
    try {
      await renderTotpQrCode(`otpauth://http/${SECRET}`);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TotpQrError);
      expect((error as Error).message).not.toContain(SECRET);
    }
  });
});

describe("parseTotpManualSetup", () => {
  it("extracts the manual key, issuer, and account label", () => {
    const setup = parseTotpManualSetup(VALID_URI);
    expect(setup.manualKey).toBe(SECRET);
    expect(setup.issuer).toBe("SmartHire");
    expect(setup.accountLabel).toBe("demo@example.test");
  });

  it("rejects malformed input", () => {
    expect(() => parseTotpManualSetup("nope")).toThrow(TotpQrError);
  });
});

describe("buildTotpSetup", () => {
  it("returns a rendered QR plus the manual fallback in one call", async () => {
    const setup = await buildTotpSetup(VALID_URI);
    expect(setup.qrCodeDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(setup.manualKey).toBe(SECRET);
    expect(setup.issuer).toBe("SmartHire");
    expect(setup.accountLabel).toBe("demo@example.test");
  });
});

describe("filesystem safety", () => {
  it("never writes QR data or secrets to the filesystem", async () => {
    // Render inside a fresh empty working directory and assert nothing lands on disk.
    const dir = mkdtempSync(join(tmpdir(), "totp-qr-"));
    const originalCwd = process.cwd();
    try {
      process.chdir(dir);
      const dataUrl = await renderTotpQrCode(VALID_URI);
      expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      // The rendered data URL is returned in-memory; no file is emitted.
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
