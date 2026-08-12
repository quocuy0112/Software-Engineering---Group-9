import "server-only";
import { cvConfiguration } from "@/backend/cv/config";
import { ClamAvScanner } from "@/backend/cv/scanning/clamav";
import type { MalwareScanner } from "@/backend/cv/scanning/malware-scanner";
import { normalizeBusinessEvidencePreview } from "./business-evidence-preview";

export type EvidenceSafetyResult = {
  detectedMediaType: "application/pdf" | "image/png" | "image/jpeg" | null;
  malware: "PASS" | "FAIL" | "INDETERMINATE";
  type: "PASS" | "FAIL" | "INDETERMINATE";
  structure: "PASS" | "FAIL" | "INDETERMINATE";
  preview: "PASS" | "FAIL" | "INDETERMINATE";
  policyVersions: {
    malware: string;
    type: "magic-v1";
    structure: "document-decode-v1";
    preview: "normalized-preview-v1";
    evidence: "business-license-evidence-v1";
  };
  failureCode?: string;
};

function detect(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf" as const;
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png" as const;
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9
  )
    return "image/jpeg" as const;
  return null;
}

async function* source(bytes: Buffer) {
  yield bytes;
}

export class EvidenceSafetyPipeline {
  constructor(
    private readonly scanner: MalwareScanner = new ClamAvScanner({
      socketPath: cvConfiguration.scanner.socketPath,
      maximumBytes: 5_000_000,
      timeoutMs: 20_000,
      signatureMaximumAgeMs:
        cvConfiguration.scanner.signatureMaximumAgeHours * 60 * 60_000,
    }),
  ) {}

  async inspect(
    bytes: Buffer,
    declared: string,
  ): Promise<EvidenceSafetyResult> {
    const detected = detect(bytes);
    let malware: EvidenceSafetyResult["malware"];
    let malwareVersion = "clamav-unavailable";
    try {
      const scan = await this.scanner.scan(source(bytes));
      malware = scan.outcome === "CLEAN" ? "PASS" : "FAIL";
      malwareVersion =
        scan.outcome === "CLEAN" ? scan.engineVersion : "clamav-detected";
    } catch {
      malware = "INDETERMINATE";
    }

    const type = detected ? (detected === declared ? "PASS" : "FAIL") : "FAIL";
    let structure: EvidenceSafetyResult["structure"] = "INDETERMINATE";
    let preview: EvidenceSafetyResult["preview"] = "INDETERMINATE";
    if (malware === "FAIL" || type === "FAIL") {
      // A known unsafe input must never remain ambiguously previewable. Only
      // infrastructure failures use INDETERMINATE so the worker can retry.
      structure = "FAIL";
      preview = "FAIL";
    } else if (malware === "PASS" && type === "PASS" && detected) {
      try {
        const normalized = await normalizeBusinessEvidencePreview(
          bytes,
          detected,
        );
        structure = normalized.byteLength > 0 ? "PASS" : "FAIL";
        preview = structure;
      } catch {
        structure = "FAIL";
        preview = "FAIL";
      }
    }

    const failureCode =
      malware === "FAIL"
        ? "MALWARE_DETECTED"
        : malware === "INDETERMINATE"
          ? "SCANNER_UNAVAILABLE"
          : type === "FAIL"
            ? "TYPE_MISMATCH"
            : structure === "FAIL"
              ? "STRUCTURE_INVALID"
              : preview !== "PASS"
                ? "PREVIEW_UNSAFE"
                : undefined;
    return {
      detectedMediaType: detected,
      malware,
      type,
      structure,
      preview,
      policyVersions: {
        malware: malwareVersion,
        type: "magic-v1",
        structure: "document-decode-v1",
        preview: "normalized-preview-v1",
        evidence: "business-license-evidence-v1",
      },
      ...(failureCode ? { failureCode } : {}),
    };
  }
}
