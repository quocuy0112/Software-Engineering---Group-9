import "server-only";

export class CvHappyPathError extends Error {
  readonly name = "CvHappyPathError";

  constructor(readonly code: string) {
    super(code);
  }
}

type Dependencies = Readonly<{
  acceptDelivery?(input: {
    uploadId: string;
    leaseOwner: string;
  }): Promise<boolean>;
  validateEnvelope(): Promise<void>;
  verifySourceIntegrity(): Promise<void>;
  scan(): Promise<"CLEAN" | "INFECTED" | "INDETERMINATE">;
  extract(): Promise<unknown>;
  verifyExtractionIntegrity(): Promise<void>;
  parse(): Promise<unknown>;
  createDraft(): Promise<void>;
}>;

export class CvHappyPathPipeline {
  constructor(private readonly dependencies: Dependencies) {}

  async execute(input: { uploadId: string; leaseOwner: string }) {
    if (
      this.dependencies.acceptDelivery &&
      !(await this.dependencies.acceptDelivery(input))
    )
      throw new CvHappyPathError("CV_LEASE_LOST");
    await this.dependencies.validateEnvelope();
    await this.dependencies.verifySourceIntegrity();
    const scan = await this.dependencies.scan();
    if (scan !== "CLEAN")
      throw new CvHappyPathError(
        scan === "INFECTED" ? "MALWARE_DETECTED" : "SCANNER_UNAVAILABLE",
      );
    await this.dependencies.extract();
    await this.dependencies.verifyExtractionIntegrity();
    await this.dependencies.parse();
    await this.dependencies.createDraft();
  }
}
