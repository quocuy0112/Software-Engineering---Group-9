export const OCR_CONFIDENCE_POLICY = {
  version: "ocr-confidence-v1",
  highMinimum: 0.9,
  reviewMinimum: 0.7,
} as const;

export const OCR_PURPOSE_PROFILES = {
  CV_IMPORT: {
    unitDeadlineMs: 20_000,
    aggregateDeadlineMs: 180_000,
    maximumOutputUtf8Bytes: 65_536,
    maximumLines: 2_000,
  },
  JOB_IMAGE_SEARCH: {
    unitDeadlineMs: 10_000,
    // The OCR engine stops before the worker/UDS deadline so it can merge,
    // serialize and deliver a valid partial response without a socket race.
    computeGraceMs: 900,
    maximumOutputUtf8Bytes: 32_768,
    maximumLines: 2_000,
  },
} as const;

export const OCR_MAXIMUM_INPUT_BYTES = 25 * 1024 * 1024;
export const OCR_MAXIMUM_DECODED_PIXELS = 20_000_000;
