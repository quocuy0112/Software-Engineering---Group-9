import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = resolve(process.cwd(), "tests/fixtures/ocr-corpus");
const imageRoot = join(root, "images");
const documentRoot = join(root, "documents");
const truthRoot = join(root, "truth");
const securityRoot = join(root, "security");

const languages = ["VIETNAMESE", "ENGLISH", "BILINGUAL"];
const layouts = ["CV_RESUME_PAGE", "JOB_POSTER", "FORM_TABLE", "MULTI_COLUMN"];
const qualities = [
  "LOW_RESOLUTION",
  "SKEW_PERSPECTIVE",
  "NOISY_COMPRESSED",
  "LOW_CONTRAST_BLUR",
];
const securityClasses = [
  "MALICIOUS_SIGNATURE",
  "MALFORMED_TRUNCATED",
  "POLYGLOT_ANIMATED",
  "DECOMPRESSION_LIMIT",
  "PROMPT_LIKE",
  "EXCLUDED_DOCUMENT_REGION",
];

const english = [
  "software",
  "engineer",
  "builds",
  "reliable",
  "services",
  "using",
  "typescript",
  "react",
  "node",
  "postgresql",
  "testing",
  "security",
  "accessibility",
  "remote",
  "hybrid",
  "team",
  "delivery",
  "quality",
  "design",
  "review",
  "systems",
  "cloud",
  "docker",
  "monitoring",
  "documentation",
  "performance",
  "privacy",
  "candidate",
  "experience",
  "skills",
  "project",
  "product",
  "customer",
  "platform",
  "application",
  "architecture",
  "collaboration",
  "learning",
  "ownership",
  "communication",
];
const vietnamese = [
  "kỹ",
  "sư",
  "phần",
  "mềm",
  "xây",
  "dựng",
  "dịch",
  "vụ",
  "ổn",
  "định",
  "bằng",
  "typescript",
  "react",
  "node",
  "postgresql",
  "kiểm",
  "thử",
  "bảo",
  "mật",
  "truy",
  "cập",
  "từ",
  "xa",
  "kết",
  "hợp",
  "nhóm",
  "chất",
  "lượng",
  "thiết",
  "kế",
  "hệ",
  "thống",
  "đám",
  "mây",
  "docker",
  "giám",
  "sát",
  "tài",
  "liệu",
  "hiệu",
  "năng",
  "riêng",
  "tư",
  "ứng",
  "viên",
  "kinh",
  "nghiệm",
  "kỹ",
  "năng",
  "dự",
  "án",
];

function wordsFor(language, index, count = 120) {
  const source =
    language === "VIETNAMESE"
      ? vietnamese
      : language === "ENGLISH"
        ? english
        : vietnamese.flatMap((word, offset) => [
            word,
            english[(offset + index) % english.length],
          ]);
  return Array.from(
    { length: count },
    (_, offset) => source[(offset * 7 + index) % source.length],
  );
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svgFor(words, id, layout) {
  const lines = [];
  for (let index = 0; index < words.length; index += 9)
    lines.push(words.slice(index, index + 9).join(" "));
  const heading =
    layout === "CV_RESUME_PAGE" ? "SYNTHETIC CV" : "SYNTHETIC JOB POSTER";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1100">
    <rect width="1400" height="1100" fill="#ffffff"/>
    <rect x="45" y="40" width="1310" height="95" rx="12" fill="#12324a"/>
    <text x="75" y="103" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#ffffff">${heading} ${id}</text>
    ${lines.map((line, index) => `<text x="75" y="${185 + index * 58}" font-family="Arial, sans-serif" font-size="28" fill="#18222c">${escapeXml(line)}</text>`).join("\n")}
  </svg>`);
}

async function renderJpeg(words, id, layout, quality) {
  let pipeline = sharp(svgFor(words, id, layout));
  if (quality === "LOW_RESOLUTION")
    pipeline = pipeline
      .resize(700, 550)
      .resize(1400, 1100, { kernel: "nearest" });
  else if (quality === "SKEW_PERSPECTIVE")
    pipeline = pipeline
      .rotate(indexAngle(id), { background: "white" })
      .resize(1400, 1100, { fit: "contain", background: "white" });
  else if (quality === "LOW_CONTRAST_BLUR")
    pipeline = pipeline
      .modulate({ brightness: 1.12, saturation: 0.25 })
      .blur(0.7);
  return pipeline
    .jpeg({ quality: quality === "NOISY_COMPRESSED" ? 42 : 88 })
    .toBuffer();
}

function indexAngle(id) {
  return Number(id.slice(-3)) % 2 ? 2.2 : -2.2;
}

function scannedPdf(jpeg, width = 1400, height = 1100) {
  const chunks = [];
  const offsets = [0];
  const push = (value) =>
    chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value, "binary"));
  push("%PDF-1.4\n%\xff\xff\xff\xff\n");
  const object = (number, body) => {
    offsets[number] = Buffer.concat(chunks).length;
    push(`${number} 0 obj\n`);
    push(body);
    push("\nendobj\n");
  };
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(
    4,
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
        "binary",
      ),
      jpeg,
      Buffer.from("\nendstream", "binary"),
    ]),
  );
  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = Buffer.concat(chunks).length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let number = 1; number <= 5; number++)
    push(`${String(offsets[number]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countWords(value) {
  return value.normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
}

async function write(relative, value) {
  const path = join(root, relative);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

await Promise.all(
  [imageRoot, documentRoot, truthRoot, securityRoot].map((path) =>
    rm(path, { recursive: true, force: true }),
  ),
);
await Promise.all(
  [imageRoot, documentRoot, truthRoot, securityRoot].map((path) =>
    mkdir(path, { recursive: true }),
  ),
);

const fixtures = [];
for (let index = 0; index < 180; index++) {
  const id = `ocr-${String(index + 1).padStart(3, "0")}`;
  const language = languages[index % languages.length];
  const purpose = index < 60 ? "CV" : "JOB_POSTER";
  const layout = layouts[index % layouts.length];
  const quality =
    index >= 60 && index < 100
      ? qualities[Math.floor((index - 60) / 10)]
      : null;
  const security =
    index >= 150 ? securityClasses[Math.floor((index - 150) / 5)] : null;
  const zeroText = index >= 150 && index < 170;
  const words = zeroText ? [] : wordsFor(language, index);
  const truth = words.join(" ");
  const truthPath = `truth/${id}.txt`;
  await write(truthPath, truth ? `${truth}\n` : "");

  let asset;
  let assetPath;
  let expectedDisposition = "OCR_TEXT";
  if (security === "MALICIOUS_SIGNATURE") {
    asset = Buffer.from(`GIF89a-SYNTHETIC-${id}`, "ascii");
    assetPath = `security/${id}.bin`;
    expectedDisposition = "REJECTED";
  } else if (security === "DECOMPRESSION_LIMIT") {
    asset = Buffer.concat([
      Buffer.from(
        "89504e470d0a1a0a0000000d494844527fffffff7fffffff0802000000",
        "hex",
      ),
      Buffer.from(id),
    ]);
    assetPath = `security/${id}.png`;
    expectedDisposition = "REJECTED";
  } else {
    const renderedWords = words.length ? words : wordsFor(language, index);
    const jpeg = await renderJpeg(renderedWords, id, layout, quality);
    if (security === "MALFORMED_TRUNCATED") {
      asset = jpeg.subarray(0, Math.max(64, Math.floor(jpeg.length / 8)));
      expectedDisposition = "REJECTED";
    } else if (security === "POLYGLOT_ANIMATED") {
      asset = Buffer.concat([
        jpeg,
        Buffer.from("PK\u0003\u0004SYNTHETIC-POLYGLOT", "binary"),
      ]);
      expectedDisposition = "REJECTED";
    } else {
      asset = jpeg;
      if (security === "EXCLUDED_DOCUMENT_REGION")
        expectedDisposition = "EXCLUDED";
    }
    assetPath = `${security ? "security" : "images"}/${id}.jpg`;
  }
  await write(assetPath, asset);

  let documentPath = null;
  if (purpose === "CV") {
    documentPath = `documents/${id}.pdf`;
    await write(documentPath, scannedPdf(asset));
  }
  fixtures.push({
    id,
    sourceClass: "SYNTHETIC",
    license: "CC0-1.0",
    generator: "generate-ocr-corpus.mjs@1",
    reviewer: "independent-label-review-required-before-release",
    language,
    purpose,
    layouts: [layout],
    qualities: quality ? [quality] : [],
    security: security ? [security] : [],
    assetPath,
    documentPath,
    truthPath,
    assetSha256: sha256(asset),
    wordCount: countWords(truth),
    expectedDisposition,
    intentLabels:
      purpose === "JOB_POSTER" && !zeroText
        ? [{ field: "skills", value: "TypeScript", supported: true }]
        : [],
  });
}

const manifest = {
  schemaVersion: "smarthire-ocr-corpus-v1",
  manifestVersion: "005-corpus-1",
  generatedBy: "web/scripts/generate-ocr-corpus.mjs",
  contentPolicy: {
    realUserDataAllowed: false,
    allowedSourceClasses: ["SYNTHETIC", "REDISTRIBUTABLE_LICENSED"],
    textNormalization: "NFKC_WHITESPACE_PRESERVE_DIACRITICS",
    zeroTextRejectionsExcludedFromWordAccuracy: true,
  },
  minimums: {
    uniqueFixtures: 180,
    labeledWords: 18000,
    cohorts: {
      VIETNAMESE: { fixtures: 40, words: 4000 },
      ENGLISH: { fixtures: 40, words: 4000 },
      BILINGUAL: { fixtures: 40, words: 4000 },
      LAYOUT: { fixtures: 40, words: 4000 },
      QUALITY: { fixtures: 40, words: 4000 },
      SECURITY: { fixtures: 30, words: 1000 },
      CV: { fixtures: 60, words: 6000 },
      JOB_POSTER: { fixtures: 60, words: 6000 },
    },
    layoutEach: Object.fromEntries(layouts.map((value) => [value, 10])),
    qualityEach: Object.fromEntries(qualities.map((value) => [value, 10])),
    securityEach: Object.fromEntries(
      securityClasses.map((value) => [value, 5]),
    ),
    posterLanguageEach: Object.fromEntries(
      languages.map((value) => [value, 20]),
    ),
  },
  fixtures,
};
await writeFile(
  join(root, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    fixtures: fixtures.length,
    labeledWords: fixtures.reduce((sum, item) => sum + item.wordCount, 0),
  }),
);
