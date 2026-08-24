import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { JobIndustryFile } from "./job-industry-files";

export type JobCatalogueLeaseClaim = {
  catalogueKey: string;
  ownerTokenHash: string;
  expectedCatalogueSha256: string;
  leaseExpiresAt: Date;
  version: number;
};

export interface JobCatalogueLeaseCoordinator {
  claim(
    input: Omit<JobCatalogueLeaseClaim, "version">,
  ): Promise<JobCatalogueLeaseClaim>;
  renew(
    claim: JobCatalogueLeaseClaim,
    leaseExpiresAt: Date,
  ): Promise<JobCatalogueLeaseClaim>;
  assertOwned(
    claim: JobCatalogueLeaseClaim,
    expectedCatalogueSha256: string,
  ): Promise<void>;
  release(claim: JobCatalogueLeaseClaim): Promise<void>;
}

export type JsonJobCatalogueRepositoryConfig = {
  filePath: string;
  /**
   * Optional read fallback used by the jobs catalogue after jobs.json has
   * been split into the 29 industry files. The original file remains the
   * writable canonical source when it exists.
   */
  fallbackFiles?: readonly JobIndustryFile[];
  mode: "writer" | "readonly";
  writerHostId: string | null;
  leaseCoordinator: JobCatalogueLeaseCoordinator;
  leaseTtlMs: number;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class JsonJobCatalogueRepository<T = unknown> {
  private readonly filePath: string;
  private readonly fallbackFiles: readonly JobIndustryFile[];

  constructor(private readonly config: JsonJobCatalogueRepositoryConfig) {
    this.filePath = resolve(config.filePath);
    this.fallbackFiles = config.fallbackFiles ?? [];
    if (!Number.isSafeInteger(config.leaseTtlMs) || config.leaseTtlMs < 1_000)
      throw new Error("JOB_CATALOGUE_CONFIG_INVALID");
  }

  async read(): Promise<T[]> {
    let text: string;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" &&
        this.fallbackFiles.length > 0
      ) {
        return this.readFallbackFiles();
      }
      throw new Error("JOB_CATALOGUE_UNAVAILABLE", { cause: error });
    }
    try {
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value)) throw new Error("not an array");
      return value as T[];
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }
  }

  private async readFallbackFiles(): Promise<T[]> {
    const { values } = await this.readFallbackDocuments();
    return values.flat();
  }

  private async readFallbackDocuments(): Promise<{
    texts: string[];
    values: T[][];
  }> {
    let texts: string[];
    try {
      texts = await Promise.all(
        this.fallbackFiles.map(({ filePath }) => readFile(filePath, "utf8")),
      );
    } catch {
      // A partial split is not a valid catalogue: fail closed instead of
      // silently serving an incomplete job list.
      throw new Error("JOB_CATALOGUE_UNAVAILABLE");
    }

    try {
      const values = texts.map((text, index) => {
        const value: unknown = JSON.parse(text);
        if (!Array.isArray(value)) throw new Error("not an array");
        const expectedCode = this.fallbackFiles[index]?.code;
        if (
          expectedCode &&
          value.some(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              "industryCode" in entry &&
              (entry as { industryCode?: unknown }).industryCode !==
                expectedCode,
          )
        ) {
          throw new Error("industry file contains a different industryCode");
        }
        return value as T[];
      });
      return { texts, values };
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }
  }

  private async sourceExists(): Promise<boolean> {
    try {
      const target = await stat(this.filePath);
      return target.isFile();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async preflight(): Promise<void> {
    if (this.config.mode !== "writer" || !this.config.writerHostId)
      throw new Error("JOB_CATALOGUE_READ_ONLY");
    const parent = await stat(dirname(this.filePath));
    if (!parent.isDirectory()) throw new Error("JOB_CATALOGUE_PATH_INVALID");
    if (await this.sourceExists()) {
      const target = await stat(this.filePath);
      if (!target.isFile()) throw new Error("JOB_CATALOGUE_PATH_INVALID");
      return;
    }
    if (this.fallbackFiles.length === 0)
      throw new Error("JOB_CATALOGUE_PATH_INVALID");
    const splitStats = await Promise.all(
      this.fallbackFiles.map(({ filePath }) => stat(filePath)),
    );
    if (splitStats.some((target) => !target.isFile()))
      throw new Error("JOB_CATALOGUE_PATH_INVALID");
  }

  async verifyWriterReadiness() {
    await this.preflight();
    if (!(await this.sourceExists()) && this.fallbackFiles.length > 0) {
      const { texts } = await this.readFallbackDocuments();
      const expectedCatalogueSha256 = sha256(texts.join("\u0000"));
      const claim = await this.config.leaseCoordinator.claim({
        catalogueKey: sha256(
          this.fallbackFiles
            .map(({ filePath }) => filePath.toLowerCase())
            .join("\u0000"),
        ),
        ownerTokenHash: sha256(
          `${this.config.writerHostId}:${randomBytes(32).toString("hex")}`,
        ),
        expectedCatalogueSha256,
        leaseExpiresAt: new Date(Date.now() + this.config.leaseTtlMs),
      });
      try {
        await this.config.leaseCoordinator.assertOwned(
          claim,
          expectedCatalogueSha256,
        );
        return { filePath: this.filePath, expectedCatalogueSha256 };
      } finally {
        await this.config.leaseCoordinator
          .release(claim)
          .catch(() => undefined);
      }
    }
    const original = await readFile(this.filePath, "utf8");
    try {
      if (!Array.isArray(JSON.parse(original))) throw new Error("not an array");
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }
    const expectedCatalogueSha256 = sha256(original);
    const claim = await this.config.leaseCoordinator.claim({
      catalogueKey: sha256(this.filePath.toLowerCase()),
      ownerTokenHash: sha256(
        `${this.config.writerHostId}:${randomBytes(32).toString("hex")}`,
      ),
      expectedCatalogueSha256,
      leaseExpiresAt: new Date(Date.now() + this.config.leaseTtlMs),
    });
    try {
      await this.config.leaseCoordinator.assertOwned(
        claim,
        expectedCatalogueSha256,
      );
      return { filePath: this.filePath, expectedCatalogueSha256 };
    } finally {
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }

  async mutate(mutation: (values: T[]) => T[] | Promise<T[]>): Promise<T[]> {
    if (!(await this.sourceExists()) && this.fallbackFiles.length > 0) {
      return this.mutateSplitFiles(mutation);
    }
    await this.preflight();
    const original = await readFile(this.filePath, "utf8");
    let values: T[];
    try {
      const parsed: unknown = JSON.parse(original);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      values = parsed as T[];
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }

    const expectedCatalogueSha256 = sha256(original);
    const catalogueKey = sha256(this.filePath.toLowerCase());
    const ownerTokenHash = sha256(
      `${this.config.writerHostId}:${randomBytes(32).toString("hex")}`,
    );
    const leaseExpiresAt = new Date(Date.now() + this.config.leaseTtlMs);
    const claim = await this.config.leaseCoordinator.claim({
      catalogueKey,
      ownerTokenHash,
      expectedCatalogueSha256,
      leaseExpiresAt,
    });
    const temporaryPath = `${this.filePath}.${ownerTokenHash.slice(0, 16)}.tmp`;
    try {
      const next = await mutation(structuredClone(values));
      if (!Array.isArray(next))
        throw new Error("JOB_CATALOGUE_MUTATION_INVALID");
      const observed = await readFile(this.filePath, "utf8");
      if (sha256(observed) !== expectedCatalogueSha256)
        throw new Error("JOB_CATALOGUE_CHECKSUM_CONFLICT");
      await this.config.leaseCoordinator.assertOwned(
        claim,
        expectedCatalogueSha256,
      );

      const handle = await open(temporaryPath, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.config.leaseCoordinator.assertOwned(
        claim,
        expectedCatalogueSha256,
      );
      const finalObserved = await readFile(this.filePath, "utf8");
      if (sha256(finalObserved) !== expectedCatalogueSha256)
        throw new Error("JOB_CATALOGUE_CHECKSUM_CONFLICT");
      await rename(temporaryPath, this.filePath);
      return next;
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }

  private async writeSplitFiles(next: T[], ownerTokenHash: string) {
    const byCode = new Map(
      this.fallbackFiles.map(({ code }) => [code, [] as T[]]),
    );
    for (const value of next) {
      const record =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : null;
      const code = record?.industryCode;
      const target =
        typeof code === "string"
          ? byCode.get(code as JobIndustryFile["code"])
          : undefined;
      if (!target) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
      target.push(value);
    }

    const temporaryPaths = this.fallbackFiles.map(
      ({ filePath }) => `${filePath}.${ownerTokenHash.slice(0, 16)}.tmp`,
    );
    try {
      await Promise.all(
        this.fallbackFiles.map(async ({ code }, index) => {
          const handle = await open(temporaryPaths[index], "wx");
          try {
            await handle.writeFile(
              `${JSON.stringify(byCode.get(code), null, 2)}\n`,
              "utf8",
            );
            await handle.sync();
          } finally {
            await handle.close();
          }
        }),
      );
      await Promise.all(
        this.fallbackFiles.map(({ filePath }, index) =>
          rename(temporaryPaths[index], filePath),
        ),
      );
    } finally {
      await Promise.all(
        temporaryPaths.map((temporaryPath) =>
          rm(temporaryPath, { force: true }).catch(() => undefined),
        ),
      );
    }
  }

  private async mutateSplitFiles(
    mutation: (values: T[]) => T[] | Promise<T[]>,
  ): Promise<T[]> {
    await this.preflight();
    const original = await this.readFallbackDocuments();
    const expectedCatalogueSha256 = sha256(original.texts.join("\u0000"));
    const catalogueKey = sha256(
      this.fallbackFiles
        .map(({ filePath }) => filePath.toLowerCase())
        .join("\u0000"),
    );
    const ownerTokenHash = sha256(
      `${this.config.writerHostId}:${randomBytes(32).toString("hex")}`,
    );
    const claim = await this.config.leaseCoordinator.claim({
      catalogueKey,
      ownerTokenHash,
      expectedCatalogueSha256,
      leaseExpiresAt: new Date(Date.now() + this.config.leaseTtlMs),
    });
    try {
      const next = await mutation(structuredClone(original.values.flat()));
      if (!Array.isArray(next))
        throw new Error("JOB_CATALOGUE_MUTATION_INVALID");
      const observed = await this.readFallbackDocuments();
      if (sha256(observed.texts.join("\u0000")) !== expectedCatalogueSha256)
        throw new Error("JOB_CATALOGUE_CHECKSUM_CONFLICT");
      await this.config.leaseCoordinator.assertOwned(
        claim,
        expectedCatalogueSha256,
      );
      await this.writeSplitFiles(next, ownerTokenHash);
      return next;
    } finally {
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }
}
