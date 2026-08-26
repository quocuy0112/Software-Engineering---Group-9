import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  catalogueIndustryCode,
  industryCodeMatchesCatalogue,
  type JobIndustryCode,
  type JobIndustryFile,
} from "./job-industry-files";

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

const REPLACE_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800] as const;
const RETRYABLE_REPLACE_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);

/**
 * Antivirus, indexing, and editor processes can briefly deny replacement of
 * an existing file on Windows. Retrying only sharing/permission failures
 * preserves atomic rename semantics without hiding path or data errors.
 */
export async function replaceFileWithRetry(
  temporaryPath: string,
  targetPath: string,
  renameFile: typeof rename = rename,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await renameFile(temporaryPath, targetPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const retryDelay = REPLACE_RETRY_DELAYS_MS[attempt];
      if (!code || !RETRYABLE_REPLACE_CODES.has(code) || !retryDelay)
        throw error;
      await delay(retryDelay);
    }
  }
}

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

  /**
   * Reads one split industry file when the default catalogue layout is in
   * use. A configured monolithic jobs.json remains supported as a fallback.
   */
  async readIndustryPartition(industryCode: string): Promise<T[]> {
    const code = catalogueIndustryCode(industryCode);
    if (!code) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
    if ((await this.sourceExists()) || this.fallbackFiles.length === 0) {
      const values = await this.read();
      return values.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        return industryCodeMatchesCatalogue(
          (entry as { industryCode?: unknown }).industryCode,
          code,
        );
      });
    }

    const partition = this.fallbackFiles.find((file) => file.code === code);
    if (!partition) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
    return this.readIndustryDocument(partition);
  }

  /**
   * Filters split files one at a time so a caller can locate a small tenant
   * subset without retaining the complete parsed catalogue in memory.
   */
  async readMatching(predicate: (value: T) => boolean): Promise<T[]> {
    if ((await this.sourceExists()) || this.fallbackFiles.length === 0) {
      return (await this.read()).filter(predicate);
    }

    const matches: T[] = [];
    for (const partition of this.fallbackFiles) {
      const values = await this.readIndustryDocument(partition);
      for (const value of values) {
        if (predicate(value)) matches.push(value);
      }
    }
    return matches;
  }

  private async readFallbackFiles(): Promise<T[]> {
    const { values } = await this.readFallbackDocuments();
    return values.flat();
  }

  private async readIndustryDocument(partition: JobIndustryFile): Promise<T[]> {
    let text: string;
    try {
      text = await readFile(partition.filePath, "utf8");
    } catch (error) {
      throw new Error("JOB_CATALOGUE_UNAVAILABLE", { cause: error });
    }
    return this.parseIndustryDocument(text, partition);
  }

  private parseIndustryDocument(text: string, partition: JobIndustryFile): T[] {
    try {
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value)) throw new Error("not an array");
      if (
        value.some(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            "industryCode" in entry &&
            !industryCodeMatchesCatalogue(
              (entry as { industryCode?: unknown }).industryCode,
              partition.code,
            ),
        )
      ) {
        throw new Error("industry file contains a different industryCode");
      }
      return value as T[];
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }
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
              !industryCodeMatchesCatalogue(
                (entry as { industryCode?: unknown }).industryCode,
                expectedCode,
              ),
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

  /**
   * Returns a cheap filesystem version for cache validation. Next server
   * route bundles can have separate module-level caches, so a mutation in
   * the PATCH route must still be observable by the page route without
   * reparsing the catalogue just to check freshness.
   */
  async readSourceVersion(): Promise<string> {
    const paths = (await this.sourceExists())
      ? [this.filePath]
      : this.fallbackFiles.map(({ filePath }) => filePath);
    if (paths.length === 0) return "missing";
    const stats = await Promise.all(paths.map((filePath) => stat(filePath)));
    return stats
      .map(({ size, mtimeMs, ctimeMs }) => `${size}:${mtimeMs}:${ctimeMs}`)
      .join("\u0000");
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
      await replaceFileWithRetry(temporaryPath, this.filePath);
      return next;
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }

  /**
   * Mutates only the requested split industry document. This keeps recruiter
   * actions independent from the total catalogue size while retaining the
   * same fenced lease used by whole-catalogue mutations.
   */
  async mutateIndustryPartition(
    industryCode: string,
    mutation: (values: T[]) => T[] | Promise<T[]>,
  ): Promise<T[]> {
    const code = catalogueIndustryCode(industryCode);
    if (!code) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
    if ((await this.sourceExists()) || this.fallbackFiles.length === 0) {
      return this.mutate(mutation);
    }

    await this.preflight();
    const partition = this.fallbackFiles.find((file) => file.code === code);
    if (!partition) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
    const original = await readFile(partition.filePath, "utf8");
    const originalValues = this.parseIndustryDocument(original, partition);
    const expectedCatalogueSha256 = sha256(original);
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
    const temporaryPath = `${partition.filePath}.${ownerTokenHash.slice(0, 16)}.tmp`;
    try {
      const next = await mutation(structuredClone(originalValues));
      if (!Array.isArray(next))
        throw new Error("JOB_CATALOGUE_MUTATION_INVALID");
      if (
        next.some(
          (entry) =>
            !entry ||
            typeof entry !== "object" ||
            !("industryCode" in entry) ||
            !industryCodeMatchesCatalogue(
              (entry as { industryCode?: unknown }).industryCode,
              code,
            ),
        )
      ) {
        throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
      }
      const observed = await readFile(partition.filePath, "utf8");
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
      const finalObserved = await readFile(partition.filePath, "utf8");
      if (sha256(finalObserved) !== expectedCatalogueSha256)
        throw new Error("JOB_CATALOGUE_CHECKSUM_CONFLICT");
      await replaceFileWithRetry(temporaryPath, partition.filePath);
      return next;
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }

  /**
   * Mutates one or more split industry documents under a single catalogue
   * lease. Recruiter edits can therefore move a job between industries
   * without reading, cloning, or serializing the complete catalogue.
   */
  async mutateIndustryPartitions(
    industryCodes: readonly string[],
    mutation: (partitions: Map<JobIndustryCode, T[]>) => void | Promise<void>,
  ): Promise<void> {
    const codes = Array.from(
      new Set(
        industryCodes
          .map((industryCode) => catalogueIndustryCode(industryCode))
          .filter((industryCode): industryCode is JobIndustryCode =>
            Boolean(industryCode),
          ),
      ),
    );
    if (codes.length === 0)
      throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");

    const assertPartition = (code: JobIndustryCode, values: T[]) => {
      if (
        values.some(
          (entry) =>
            !entry ||
            typeof entry !== "object" ||
            !("industryCode" in entry) ||
            !industryCodeMatchesCatalogue(
              (entry as { industryCode?: unknown }).industryCode,
              code,
            ),
        )
      ) {
        throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
      }
    };

    // A configured monolithic catalogue keeps the old full-file semantics.
    // The split fallback path below is the production fast path.
    if ((await this.sourceExists()) || this.fallbackFiles.length === 0) {
      await this.mutate(async (values) => {
        const partitions = new Map(
          codes.map((code) => [
            code,
            values.filter((entry) => {
              if (!entry || typeof entry !== "object") return false;
              const entryCode = (entry as { industryCode?: unknown })
                .industryCode;
              return (
                typeof entryCode === "string" &&
                industryCodeMatchesCatalogue(entryCode, code)
              );
            }),
          ]),
        );
        await mutation(partitions);
        for (const code of codes) {
          assertPartition(code, partitions.get(code) ?? []);
        }
        const targetCodes = new Set(codes);
        const next = values.filter((entry) => {
          if (!entry || typeof entry !== "object") return true;
          const entryCode = (entry as { industryCode?: unknown }).industryCode;
          const canonicalCode =
            typeof entryCode === "string"
              ? catalogueIndustryCode(entryCode)
              : null;
          return !canonicalCode || !targetCodes.has(canonicalCode);
        });
        for (const code of codes) next.push(...(partitions.get(code) ?? []));
        return next;
      });
      return;
    }

    await this.preflight();
    const originals = new Map<
      JobIndustryCode,
      { partition: JobIndustryFile; text: string; values: T[] }
    >();
    await Promise.all(
      codes.map(async (code) => {
        const partition = this.fallbackFiles.find(
          ({ code: partitionCode }) => partitionCode === code,
        );
        if (!partition) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
        const text = await readFile(partition.filePath, "utf8");
        originals.set(code, {
          partition,
          text,
          values: this.parseIndustryDocument(text, partition),
        });
      }),
    );

    const expectedCatalogueSha256 = sha256(
      codes.map((code) => originals.get(code)!.text).join("\u0000"),
    );
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
    const next = new Map(
      codes.map((code) => [code, structuredClone(originals.get(code)!.values)]),
    );
    const changedFiles: Array<{
      filePath: string;
      temporaryPath: string;
      text: string;
    }> = [];
    try {
      await mutation(next);
      for (const code of codes) {
        assertPartition(code, next.get(code) ?? []);
        const original = originals.get(code)!;
        const text = `${JSON.stringify(next.get(code), null, 2)}\n`;
        if (text !== original.text) {
          changedFiles.push({
            filePath: original.partition.filePath,
            temporaryPath: `${original.partition.filePath}.${ownerTokenHash.slice(0, 16)}.tmp`,
            text,
          });
        }
      }
      const observed = await Promise.all(
        codes.map((code) =>
          readFile(originals.get(code)!.partition.filePath, "utf8"),
        ),
      );
      if (sha256(observed.join("\u0000")) !== expectedCatalogueSha256)
        throw new Error("JOB_CATALOGUE_CHECKSUM_CONFLICT");
      await this.config.leaseCoordinator.assertOwned(
        claim,
        expectedCatalogueSha256,
      );
      await Promise.all(
        changedFiles.map(async ({ temporaryPath, text }) => {
          const handle = await open(temporaryPath, "wx");
          try {
            await handle.writeFile(text, "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
        }),
      );
      await Promise.all(
        changedFiles.map(({ filePath, temporaryPath }) =>
          replaceFileWithRetry(temporaryPath, filePath),
        ),
      );
    } finally {
      await Promise.all(
        changedFiles.map(({ temporaryPath }) =>
          rm(temporaryPath, { force: true }).catch(() => undefined),
        ),
      );
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }

  private async writeSplitFiles(
    next: T[],
    originalTexts: readonly string[],
    ownerTokenHash: string,
  ) {
    const byCode = new Map(
      this.fallbackFiles.map(({ code }) => [code, [] as T[]]),
    );
    for (const value of next) {
      const record =
        value && typeof value === "object"
          ? (value as Record<string, unknown>)
          : null;
      const code =
        typeof record?.industryCode === "string"
          ? catalogueIndustryCode(record.industryCode)
          : null;
      const target = code
        ? byCode.get(code as JobIndustryFile["code"])
        : undefined;
      if (!target) throw new Error("JOB_CATALOGUE_INDUSTRY_CODE_INVALID");
      target.push(value);
    }

    const changedFiles = this.fallbackFiles.flatMap(
      ({ code, filePath }, index) => {
        const text = `${JSON.stringify(byCode.get(code), null, 2)}\n`;
        return text === originalTexts[index]
          ? []
          : [
              {
                filePath,
                temporaryPath: `${filePath}.${ownerTokenHash.slice(0, 16)}.tmp`,
                text,
              },
            ];
      },
    );
    try {
      await Promise.all(
        changedFiles.map(async ({ temporaryPath, text }) => {
          const handle = await open(temporaryPath, "wx");
          try {
            await handle.writeFile(text, "utf8");
            await handle.sync();
          } finally {
            await handle.close();
          }
        }),
      );
      await Promise.all(
        changedFiles.map(({ filePath, temporaryPath }) =>
          replaceFileWithRetry(temporaryPath, filePath),
        ),
      );
    } finally {
      await Promise.all(
        changedFiles.map(({ temporaryPath }) =>
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
      await this.writeSplitFiles(next, original.texts, ownerTokenHash);
      return next;
    } finally {
      await this.config.leaseCoordinator.release(claim).catch(() => undefined);
    }
  }
}
