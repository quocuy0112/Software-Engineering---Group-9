import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
  mode: "writer" | "readonly";
  writerHostId: string | null;
  leaseCoordinator: JobCatalogueLeaseCoordinator;
  leaseTtlMs: number;
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export class JsonJobCatalogueRepository<T = unknown> {
  private readonly filePath: string;

  constructor(private readonly config: JsonJobCatalogueRepositoryConfig) {
    this.filePath = resolve(config.filePath);
    if (!Number.isSafeInteger(config.leaseTtlMs) || config.leaseTtlMs < 1_000)
      throw new Error("JOB_CATALOGUE_CONFIG_INVALID");
  }

  async read(): Promise<T[]> {
    let text: string;
    try {
      text = await readFile(this.filePath, "utf8");
    } catch {
      throw new Error("JOB_CATALOGUE_UNAVAILABLE");
    }
    try {
      const value: unknown = JSON.parse(text);
      if (!Array.isArray(value)) throw new Error("not an array");
      return value as T[];
    } catch {
      throw new Error("JOB_CATALOGUE_MALFORMED");
    }
  }

  async preflight(): Promise<void> {
    if (this.config.mode !== "writer" || !this.config.writerHostId)
      throw new Error("JOB_CATALOGUE_READ_ONLY");
    const target = await stat(this.filePath);
    const parent = await stat(dirname(this.filePath));
    if (!target.isFile() || !parent.isDirectory())
      throw new Error("JOB_CATALOGUE_PATH_INVALID");
  }

  async verifyWriterReadiness() {
    await this.preflight();
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
}
