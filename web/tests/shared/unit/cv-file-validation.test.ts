import { describe, expect, it } from "vitest";
import {
  CV_MAX_FILE_BYTES,
  CvFileValidationError,
  validateCvFileBytes,
} from "@/shared/cv-file-validation";

const textBytes = (value: string) => new TextEncoder().encode(value);

const pdfBytes = () => textBytes("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\n");

const docBytes = () =>
  Uint8Array.from([
    0xd0,
    0xcf,
    0x11,
    0xe0,
    0xa1,
    0xb1,
    0x1a,
    0xe1,
    ...textBytes("WordDocument"),
  ]);

const docxBytes = () =>
  textBytes("PK\u0003\u0004 [Content_Types].xml word/document.xml");

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(CvFileValidationError);
    expect((error as CvFileValidationError).code).toBe(code);
  }
}

describe("CV file signature and size validation", () => {
  it.each([
    ["PDF", pdfBytes(), "resume.pdf", "application/pdf"],
    ["DOC", docBytes(), "resume.doc", "application/msword"],
    [
      "DOCX",
      docxBytes(),
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("accepts a signed %s document", (kind, bytes, fileName, mimeType) => {
    expect(
      validateCvFileBytes({
        bytes,
        fileName,
        declaredMimeType: mimeType,
      }),
    ).toMatchObject({ kind, byteSize: bytes.byteLength });
  });

  it("rejects an image or executable renamed as a CV", () => {
    expectCode(
      () =>
        validateCvFileBytes({
          bytes: textBytes("MZ\u0000not a document"),
          fileName: "resume.pdf",
          declaredMimeType: "application/pdf",
        }),
      "UNSUPPORTED_FILE_TYPE",
    );
  });

  it("rejects extension and declared MIME conflicts", () => {
    expectCode(
      () =>
        validateCvFileBytes({
          bytes: pdfBytes(),
          fileName: "resume.docx",
          declaredMimeType: "application/pdf",
        }),
      "INVALID_FILE_SIGNATURE",
    );
    expectCode(
      () =>
        validateCvFileBytes({
          bytes: pdfBytes(),
          fileName: "resume.pdf",
          declaredMimeType: "application/msword",
        }),
      "INVALID_FILE_SIGNATURE",
    );
  });

  it("rejects empty and over-limit payloads before signature detection", () => {
    expectCode(
      () => validateCvFileBytes({ bytes: new Uint8Array() }),
      "FILE_EMPTY",
    );
    expectCode(
      () =>
        validateCvFileBytes({
          bytes: new Uint8Array(CV_MAX_FILE_BYTES + 1),
          fileName: "resume.pdf",
        }),
      "FILE_SIZE_EXCEEDED",
    );
  });
});
