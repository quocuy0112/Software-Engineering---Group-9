import "server-only";

import { posix } from "node:path";
import { promisify } from "node:util";

import yauzl, { type Entry, type ZipFile } from "yauzl";

import { SharpImageNormalizer } from "@/backend/ocr/image-normalizer";
import {
  cvExtractionManifestSchema,
  type CvExtractionManifest,
  type CvExtractionUnit,
  type NativeCvSegment,
} from "@/shared/contracts/ocr/cv-extraction";
import { DocumentExtractionError } from "./document-extractor";
import { extractDocx } from "./docx";
import type { PrivateRasterWorkspace } from "./private-raster-workspace";

const openZip = promisify<Buffer, yauzl.Options, ZipFile>(yauzl.fromBuffer);

function nextEntry(zip: ZipFile): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    const onEntry = (entry: Entry) => done(entry);
    const onEnd = () => done(null);
    const onError = () => fail();
    const cleanup = () => {
      zip.off("entry", onEntry);
      zip.off("end", onEnd);
      zip.off("error", onError);
    };
    const done = (entry: Entry | null) => {
      cleanup();
      resolve(entry);
    };
    const fail = () => {
      cleanup();
      reject(new DocumentExtractionError("MALFORMED_ZIP"));
    };
    zip.once("entry", onEntry);
    zip.once("end", onEnd);
    zip.once("error", onError);
    zip.readEntry();
  });
}

function readEntry(zip: ZipFile, entry: Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream)
        return reject(new DocumentExtractionError("MALFORMED_ZIP"));
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      stream.once("error", () =>
        reject(new DocumentExtractionError("MALFORMED_ZIP")),
      );
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  });
}

async function readPackage(source: Uint8Array) {
  const zip = await openZip(Buffer.from(source), {
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    strictFileNames: true,
  });
  const entries = new Map<string, Buffer>();
  try {
    while (true) {
      const entry = await nextEntry(zip);
      if (!entry) break;
      if (/\/$/u.test(entry.fileName)) continue;
      entries.set(
        entry.fileName.replaceAll("\\", "/"),
        await readEntry(zip, entry),
      );
    }
  } finally {
    zip.close();
  }
  return entries;
}

type InspectedImage = Readonly<{
  format: string;
  width: number;
  height: number;
  normalizedPngPath: string | null;
}>;

function attribute(tag: string, localName: string) {
  const match = tag.match(
    new RegExp(`(?:\\w+:)?${localName}\\s*=\\s*["']([^"']+)["']`, "iu"),
  );
  return match?.[1] ?? null;
}

function relationshipMap(xml: string) {
  const relationships = new Map<
    string,
    { target: string; external: boolean }
  >();
  for (const match of xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/giu)) {
    const tag = match[0];
    const id = attribute(tag, "Id");
    const target = attribute(tag, "Target");
    const type = attribute(tag, "Type") ?? "";
    if (!id || !target || !type.endsWith("/image")) continue;
    const resolvedTarget = posix.normalize(
      posix.join("word", target.replaceAll("\\", "/")),
    );
    if (!resolvedTarget.startsWith("word/") || resolvedTarget.includes("/../"))
      throw new DocumentExtractionError("TRAVERSAL");
    relationships.set(id, {
      target: resolvedTarget,
      external: attribute(tag, "TargetMode") === "External",
    });
  }
  return relationships;
}

function paragraphText(xml: string) {
  return [...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/giu)]
    .map((match) => match[1] ?? "")
    .join(" ")
    .replace(/<[^>]+>/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export async function inventoryDocxBodyImages(input: {
  documentXml: string;
  relationshipsXml: string;
  inspectImage(target: string): Promise<InspectedImage>;
}): Promise<{
  units: CvExtractionUnit[];
  eligibleImageCount: number;
  eligibleImageDecodedPixels: number;
}> {
  if (/<!DOCTYPE|<!ENTITY/iu.test(input.documentXml + input.relationshipsXml))
    throw new DocumentExtractionError("ACTIVE_CONTENT");
  const relationships = relationshipMap(input.relationshipsXml);
  const body = input.documentXml.match(
    /<(?:\w+:)?body\b[^>]*>([\s\S]*?)<\/(?:\w+:)?body>/iu,
  )?.[1];
  if (body === undefined) throw new DocumentExtractionError("MALFORMED_ZIP");

  const blocks = [
    ...body.matchAll(/<(?:\w+:)?p\b[^>]*>[\s\S]*?<\/(?:\w+:)?p>/giu),
  ];
  const units: CvExtractionUnit[] = [];
  let nearestAnchor: string | null = null;
  let eligibleImageCount = 0;
  let eligibleImageDecodedPixels = 0;
  let paragraphOrdinal = 0;
  let imageOrdinal = 0;
  let pendingNative: NativeCvSegment[] = [];
  for (const blockMatch of blocks) {
    const block = blockMatch[0];
    const text = paragraphText(block);
    if (text) {
      paragraphOrdinal += 1;
      nearestAnchor = `docx-paragraph-${paragraphOrdinal}`;
      pendingNative.push({
        id: nearestAnchor,
        kind: "paragraph",
        text: text.normalize("NFKC"),
      });
    }
    const references = [
      ...block.matchAll(/<(?:\w+:)?(?:blip|imagedata)\b[^>]*>/giu),
    ];
    for (const reference of references) {
      const relationshipId =
        attribute(reference[0], "embed") ?? attribute(reference[0], "id");
      const relationship = relationshipId
        ? relationships.get(relationshipId)
        : undefined;
      if (!relationship || relationship.external)
        throw new DocumentExtractionError("EXTERNAL_RELATIONSHIP");
      const inspected = await input.inspectImage(relationship.target);
      const supported =
        ["png", "jpeg", "jpg"].includes(inspected.format.toLowerCase()) &&
        Boolean(inspected.normalizedPngPath);
      if (supported) {
        eligibleImageCount += 1;
        eligibleImageDecodedPixels += inspected.width * inspected.height;
        if (eligibleImageCount > 20)
          throw new DocumentExtractionError("DOCX_IMAGE_LIMIT");
        if (eligibleImageDecodedPixels > 100_000_000)
          throw new DocumentExtractionError("DOCX_PIXEL_LIMIT");
      }
      units.push({
        unitKey: `docx-image-${imageOrdinal + 1}`,
        ordinal: units.length,
        kind: "DOCX_BODY_IMAGE",
        classification: supported
          ? "ELIGIBLE_BODY_IMAGE"
          : "EXCLUDED_UNSUPPORTED_IMAGE",
        nativeSegments: pendingNative,
        pageNumber: null,
        bodyOrdinal: paragraphOrdinal,
        imageOrdinal,
        anchorSegmentId: nearestAnchor,
        anchorQuality: nearestAnchor ? "EXACT" : "APPROXIMATE",
        privateNormalizedPngPath: supported
          ? inspected.normalizedPngPath
          : null,
        sourceDecodedPixels: supported
          ? inspected.width * inspected.height
          : null,
      });
      pendingNative = [];
      imageOrdinal += 1;
    }
  }
  if (pendingNative.length && units.length) {
    const last = units.at(-1)!;
    units[units.length - 1] = {
      ...last,
      nativeSegments: [...last.nativeSegments, ...pendingNative],
    };
  }
  return { units, eligibleImageCount, eligibleImageDecodedPixels };
}

export async function createDocxOcrManifest(input: {
  source: Uint8Array;
  workspace: PrivateRasterWorkspace;
  limits: Readonly<{
    maximumDocxEntries: number;
    maximumDocxExpandedBytes: number;
    maximumOutputBytes: number;
  }>;
}): Promise<{
  manifest: CvExtractionManifest;
  nativeSegments: readonly NativeCvSegment[];
}> {
  const native = await extractDocx(input.source, input.limits, {
    allowEmptyText: true,
  });
  const entries = await readPackage(input.source);
  const documentXml = entries.get("word/document.xml")?.toString("utf8");
  const relationshipsXml = entries
    .get("word/_rels/document.xml.rels")
    ?.toString("utf8");
  if (!documentXml) throw new DocumentExtractionError("MALFORMED_ZIP");
  const normalizer = new SharpImageNormalizer({
    assertCleanAssessment: async (assessmentId, purpose) => {
      if (assessmentId !== "parent-clean-scan" || purpose !== "DOCX_BODY_IMAGE")
        throw new Error("CV_EXTRACTION_REQUIRES_CLEAN_SCAN");
    },
  });
  const controller = new AbortController();
  const inspectedImages = new Map<string, InspectedImage>();
  const inventory = await inventoryDocxBodyImages({
    documentXml,
    relationshipsXml:
      relationshipsXml ??
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>',
    inspectImage: async (target) => {
      const cached = inspectedImages.get(target);
      if (cached) return cached;
      const extension = posix.extname(target).slice(1).toLowerCase();
      if (!["png", "jpg", "jpeg"].includes(extension)) {
        const excluded = {
          format: extension,
          width: 1,
          height: 1,
          normalizedPngPath: null,
        };
        inspectedImages.set(target, excluded);
        return excluded;
      }
      const bytes = entries.get(target);
      if (!bytes) throw new DocumentExtractionError("MALFORMED_ZIP");
      const normalized = await normalizer.normalize({
        purpose: "DOCX_BODY_IMAGE",
        cleanAssessmentId: "parent-clean-scan",
        source: (async function* () {
          yield bytes;
        })(),
        declaredFormat: extension === "png" ? "png" : "jpeg",
        maximumSourceBytes: 5_000_000,
        maximumDecodedPixels: 20_000_000,
        maximumOutputBytes: 25 * 1024 * 1024,
        signal: controller.signal,
      });
      const inspected = {
        format: normalized.sourceFormat,
        width: normalized.width,
        height: normalized.height,
        normalizedPngPath: await input.workspace.writePng(
          `docx-image-${target.replace(/[^A-Za-z0-9_-]+/gu, "-")}`.slice(
            0,
            100,
          ),
          normalized.bytes,
        ),
      };
      inspectedImages.set(target, inspected);
      return inspected;
    },
  });
  const manifest = cvExtractionManifestSchema.parse({
    schemaVersion: "cv-extraction-manifest-v1",
    documentKind: "DOCX",
    eligibilityPolicyVersion: "cv-ocr-eligibility-v1",
    pageCount: null,
    entryCount: native.entryCount,
    expandedBytes: native.expandedBytes,
    eligibleImageCount: inventory.eligibleImageCount,
    eligibleImageDecodedPixels: inventory.eligibleImageDecodedPixels,
    units: inventory.units,
  });
  return { manifest, nativeSegments: native.segments };
}
