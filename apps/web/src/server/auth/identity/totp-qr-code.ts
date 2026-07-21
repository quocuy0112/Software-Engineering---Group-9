import "server-only";
import QRCode from "qrcode";

/**
 * Server-only QR boundary for TOTP enrollment. Accepts the Better Auth-generated
 * otpauth URI, validates it, and renders a QR code locally with qrcode 1.5.4.
 *
 * Guarantees:
 *  - no external network request (qrcode renders purely in-process),
 *  - never writes QR data or secrets to the filesystem or database,
 *  - never logs the URI, secret, QR payload, or any credential,
 *  - returns safe, redacted errors that never echo the secret-bearing input.
 */

export class TotpQrError extends Error {
  constructor(message = "Unable to render the enrollment QR code.") {
    super(message);
    this.name = "TotpQrError";
  }
}

export type TotpQrOptions = {
  /** QR module size in pixels; bounded to a safe rendering range. */
  width?: number;
  /** Quiet-zone margin in modules. */
  margin?: number;
  /** Error-correction level accepted by qrcode. */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
};

const MIN_WIDTH = 128;
const MAX_WIDTH = 512;
const MAX_MARGIN = 8;
const VALID_LEVELS = new Set(["L", "M", "Q", "H"]);

function assertOtpauthUri(uri: unknown): URL {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > 2048) {
    throw new TotpQrError();
  }
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new TotpQrError();
  }
  // Reject any non-otpauth protocol (blocks http/https/javascript/data, etc.).
  if (parsed.protocol !== "otpauth:") throw new TotpQrError();
  // Better Auth emits otpauth://totp/<issuer:account>?secret=...&issuer=...
  if (parsed.host.toLowerCase() !== "totp") throw new TotpQrError();

  const label = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (label.length === 0) throw new TotpQrError();

  const secret = parsed.searchParams.get("secret");
  const issuer = parsed.searchParams.get("issuer");
  if (!secret || secret.length === 0) throw new TotpQrError();
  if (!issuer || issuer.length === 0) throw new TotpQrError();

  return parsed;
}

function normalizeOptions(options: TotpQrOptions = {}): Required<TotpQrOptions> {
  const width = options.width ?? 240;
  const margin = options.margin ?? 4;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? "M";

  if (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH) throw new TotpQrError();
  if (!Number.isInteger(margin) || margin < 0 || margin > MAX_MARGIN) throw new TotpQrError();
  if (!VALID_LEVELS.has(errorCorrectionLevel)) throw new TotpQrError();

  return { width, margin, errorCorrectionLevel };
}

/**
 * Renders the supplied otpauth URI to a PNG data URL. The URI and secret never
 * leave this function; on any failure a generic {@link TotpQrError} is thrown.
 */
export async function renderTotpQrCode(otpauthUri: string, options: TotpQrOptions = {}): Promise<string> {
  const validated = assertOtpauthUri(otpauthUri);
  const rendering = normalizeOptions(options);
  try {
    return await QRCode.toDataURL(validated.toString(), {
      type: "image/png",
      errorCorrectionLevel: rendering.errorCorrectionLevel,
      width: rendering.width,
      margin: rendering.margin,
    });
  } catch {
    // Never surface qrcode internals or the secret-bearing input.
    throw new TotpQrError();
  }
}

/** Manual-entry fallback material parsed from a validated otpauth URI. */
export type TotpManualSetup = {
  /** Base32 secret for manual authenticator entry. */
  manualKey: string;
  issuer: string;
  accountLabel: string;
};

/**
 * Parses the issuer, account label, and manual-entry secret from an otpauth URI.
 * Applies the same validation as {@link renderTotpQrCode} and throws a generic
 * {@link TotpQrError} on any malformed input. Never logs the URI or secret.
 */
export function parseTotpManualSetup(otpauthUri: string): TotpManualSetup {
  const validated = assertOtpauthUri(otpauthUri);
  const label = decodeURIComponent(validated.pathname.replace(/^\//, ""));
  const issuerParam = validated.searchParams.get("issuer") ?? "";
  // Better Auth label format is "<issuer>:<account>"; fall back gracefully.
  const separator = label.indexOf(":");
  const accountLabel = separator >= 0 ? label.slice(separator + 1) : label;
  const secret = validated.searchParams.get("secret") ?? "";
  if (!secret) throw new TotpQrError();
  return { manualKey: secret, issuer: issuerParam, accountLabel };
}

/**
 * Convenience boundary used by the enrollment service: validates once, renders
 * the QR locally, and returns the manual-entry fallback in a single call.
 */
export async function buildTotpSetup(
  otpauthUri: string,
  options: TotpQrOptions = {},
): Promise<{ qrCodeDataUrl: string; manualKey: string; issuer: string; accountLabel: string }> {
  const qrCodeDataUrl = await renderTotpQrCode(otpauthUri, options);
  const manual = parseTotpManualSetup(otpauthUri);
  return { qrCodeDataUrl, ...manual };
}
