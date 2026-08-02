import { createHash } from "node:crypto";

export type CvFixtureAccount = Readonly<{
  id: string;
  email: string;
  displayName: string;
  sessionToken: string;
}>;

export type CvFixtureSegment = Readonly<{
  id: string;
  kind: "heading" | "paragraph" | "list-item";
  text: string;
}>;

export type CvFixtureScanResult =
  | Readonly<{ outcome: "CLEAN"; engine: "1.4.5" }>
  | Readonly<{ outcome: "INFECTED"; threatCode: "EICAR_TEST_FILE" }>
  | Readonly<{ outcome: "UNAVAILABLE" | "TIMEOUT" }>;

export type CvFixtureAuditEvent = Readonly<{
  action: string;
  accountId: string;
  targetId: string;
  resultCode: string;
  occurredAt: Date;
}>;

const FIXTURE_NAMESPACE = "smarthire-feature-004-synthetic";

const deterministicId = (label: string) =>
  createHash("sha256")
    .update(`${FIXTURE_NAMESPACE}:${label}`, "utf8")
    .digest("hex")
    .slice(0, 24);

export const CV_FIXTURE_ACCOUNTS = [
  {
    id: "00000000-0000-4000-8000-000000000004",
    email: "cv-owner@example.invalid",
    displayName: "Synthetic Candidate A",
    sessionToken: `session_${deterministicId("owner-session")}`,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    email: "cv-other@example.invalid",
    displayName: "Synthetic Candidate B",
    sessionToken: `session_${deterministicId("other-session")}`,
  },
] as const satisfies readonly [CvFixtureAccount, CvFixtureAccount];

export class CvFixtureClock {
  #current: Date;

  constructor(initial: Date | string = "2026-08-01T00:00:00.000Z") {
    this.#current = new Date(initial);
    if (Number.isNaN(this.#current.getTime())) {
      throw new Error("CV fixture clock requires a valid instant");
    }
  }

  now = (): Date => new Date(this.#current);

  set(instant: Date | string): Date {
    const next = new Date(instant);
    if (Number.isNaN(next.getTime())) {
      throw new Error("CV fixture clock cannot use an invalid instant");
    }
    this.#current = next;
    return this.now();
  }

  advance(milliseconds: number): Date {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error(
        "CV fixture clock advance must be a non-negative integer",
      );
    }
    this.#current = new Date(this.#current.getTime() + milliseconds);
    return this.now();
  }
}

export class CvFixtureStorage {
  #objects = new Map<string, Buffer>();
  readonly operations: Array<
    Readonly<{ operation: "PUT" | "OPEN" | "DELETE"; objectKey: string }>
  > = [];

  async put(objectKey: string, bytes: Uint8Array): Promise<void> {
    if (!objectKey.startsWith("fixture/")) {
      throw new Error(
        "CV fixture object keys must stay in the fixture namespace",
      );
    }
    this.#objects.set(objectKey, Buffer.from(bytes));
    this.operations.push({ operation: "PUT", objectKey });
  }

  async open(objectKey: string): Promise<Buffer> {
    const bytes = this.#objects.get(objectKey);
    if (!bytes) throw new Error("CV fixture object is absent");
    this.operations.push({ operation: "OPEN", objectKey });
    return Buffer.from(bytes);
  }

  async delete(objectKey: string): Promise<boolean> {
    this.operations.push({ operation: "DELETE", objectKey });
    return this.#objects.delete(objectKey);
  }

  has(objectKey: string): boolean {
    return this.#objects.has(objectKey);
  }

  clear(): void {
    this.#objects.clear();
    this.operations.length = 0;
  }
}

export class CvFixtureScanner {
  readonly calls: Array<Readonly<{ byteLength: number }>> = [];
  #results: CvFixtureScanResult[];

  constructor(
    results: readonly CvFixtureScanResult[] = [
      { outcome: "CLEAN", engine: "1.4.5" },
    ],
  ) {
    this.#results = results.map((result) => structuredClone(result));
  }

  enqueue(result: CvFixtureScanResult): void {
    this.#results.push(structuredClone(result));
  }

  async scan(bytes: Uint8Array): Promise<CvFixtureScanResult> {
    this.calls.push({ byteLength: bytes.byteLength });
    const result = this.#results.shift();
    if (!result) throw new Error("CV fixture scanner has no scripted result");
    return structuredClone(result);
  }
}

export class CvFixtureExtractor {
  readonly calls: Array<
    Readonly<{ format: "PDF" | "DOCX"; byteLength: number }>
  > = [];

  constructor(
    private readonly segments: readonly CvFixtureSegment[] = [
      {
        id: "segment-heading-1",
        kind: "heading",
        text: "Synthetic Platform Engineer",
      },
      {
        id: "segment-experience-1",
        kind: "paragraph",
        text: "Built deterministic test systems for Example Laboratory.",
      },
      {
        id: "segment-skill-1",
        kind: "list-item",
        text: "TypeScript",
      },
    ],
  ) {}

  async extract(
    format: "PDF" | "DOCX",
    bytes: Uint8Array,
  ): Promise<readonly CvFixtureSegment[]> {
    this.calls.push({ format, byteLength: bytes.byteLength });
    return structuredClone(this.segments);
  }
}

export const buildCvFixtureParserOutput = (
  segmentIds: readonly string[] = [
    "segment-heading-1",
    "segment-experience-1",
    "segment-skill-1",
  ],
) => ({
  schemaVersion: "cv-draft-v1" as const,
  scalars: {
    headline: {
      value: "Synthetic Platform Engineer",
      confidence: 0.98,
      sourceSegmentIds: [segmentIds[0]],
    },
    summary: null,
    phone: null,
    location: {
      value: "Test City",
      confidence: 0.75,
      sourceSegmentIds: [segmentIds[0]],
    },
  },
  experiences: [
    {
      title: "Test Systems Engineer",
      company: "Example Laboratory",
      description: "Built deterministic test systems.",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      confidence: 0.96,
      sourceSegmentIds: [segmentIds[1]],
    },
  ],
  education: [],
  skills: [
    {
      name: "TypeScript",
      confidence: 0.99,
      sourceSegmentIds: [segmentIds[2]],
    },
  ],
  socialLinks: [],
});

export class CvFixtureParser {
  readonly parserClass = "DETERMINISTIC_INTERNAL" as const;
  readonly calls: Array<Readonly<{ segmentIds: readonly string[] }>> = [];

  async parse(segments: readonly CvFixtureSegment[]) {
    const segmentIds = segments.map((segment) => segment.id);
    this.calls.push({ segmentIds });
    return {
      output: structuredClone(buildCvFixtureParserOutput(segmentIds)),
      dispatch: {
        parserClass: this.parserClass,
        provider: "smarthire-fixture",
        model: "deterministic-v1",
        inputVersion: "cv-segments-v1",
        instructionVersion: "cv-extract-v1",
        schemaVersion: "cv-draft-v1",
      } as const,
    };
  }
}

export class CvFixtureLeaseCrash extends Error {
  readonly code = "FIXTURE_LEASE_CRASH";

  constructor(readonly checkpoint: string) {
    super(`Synthetic lease crash at ${checkpoint}`);
    this.name = "CvFixtureLeaseCrash";
  }
}

export class CvFixtureLeaseCrashController {
  #armedCheckpoint: string | null = null;

  arm(checkpoint: string): void {
    this.#armedCheckpoint = checkpoint;
  }

  hit(checkpoint: string): void {
    if (this.#armedCheckpoint !== checkpoint) return;
    this.#armedCheckpoint = null;
    throw new CvFixtureLeaseCrash(checkpoint);
  }

  reset(): void {
    this.#armedCheckpoint = null;
  }
}

export class CvFixtureAuditSink {
  #events: CvFixtureAuditEvent[] = [];

  record(event: CvFixtureAuditEvent): void {
    this.#events.push(structuredClone(event));
  }

  all(): readonly CvFixtureAuditEvent[] {
    return structuredClone(this.#events);
  }

  clear(): void {
    this.#events = [];
  }
}

export function createCvImportFixture(options?: {
  initialTime?: Date | string;
  scanResults?: readonly CvFixtureScanResult[];
}) {
  const clock = new CvFixtureClock(options?.initialTime);
  return {
    accounts: CV_FIXTURE_ACCOUNTS,
    owner: CV_FIXTURE_ACCOUNTS[0],
    otherAccount: CV_FIXTURE_ACCOUNTS[1],
    clock,
    storage: new CvFixtureStorage(),
    scanner: new CvFixtureScanner(options?.scanResults),
    extractor: new CvFixtureExtractor(),
    parser: new CvFixtureParser(),
    leaseCrash: new CvFixtureLeaseCrashController(),
    audit: new CvFixtureAuditSink(),
  } as const;
}
