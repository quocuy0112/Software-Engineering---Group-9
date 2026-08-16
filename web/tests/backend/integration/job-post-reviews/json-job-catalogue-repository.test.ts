import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  JsonJobCatalogueRepository,
  type JobCatalogueLeaseClaim,
  type JobCatalogueLeaseCoordinator,
} from "@/backend/repositories/jobs/json-job-catalogue-repository";
import { buildJobReviewSnapshot } from "../../../helpers/job-post-reviews/job-post-review-fixtures";

class FakeLeaseCoordinator implements JobCatalogueLeaseCoordinator {
  private version = 0;
  active: JobCatalogueLeaseClaim | null = null;
  rejectOwnership = false;

  async claim(input: {
    catalogueKey: string;
    ownerTokenHash: string;
    expectedCatalogueSha256: string;
    leaseExpiresAt: Date;
  }) {
    if (this.active && this.active.leaseExpiresAt > new Date())
      throw new Error("JOB_CATALOGUE_LEASE_BUSY");
    this.active = { ...input, version: ++this.version };
    return this.active;
  }

  async renew(claim: JobCatalogueLeaseClaim, leaseExpiresAt: Date) {
    await this.assertOwned(claim, claim.expectedCatalogueSha256);
    this.active = { ...claim, leaseExpiresAt };
    return this.active;
  }

  async assertOwned(
    claim: JobCatalogueLeaseClaim,
    expectedCatalogueSha256: string,
  ) {
    if (
      this.rejectOwnership ||
      !this.active ||
      this.active.ownerTokenHash !== claim.ownerTokenHash ||
      this.active.version !== claim.version ||
      this.active.expectedCatalogueSha256 !== expectedCatalogueSha256
    )
      throw new Error("JOB_CATALOGUE_LEASE_LOST");
  }

  async release(claim: JobCatalogueLeaseClaim) {
    if (this.active?.ownerTokenHash === claim.ownerTokenHash)
      this.active = null;
  }
}

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixture(mode: "writer" | "readonly" = "writer") {
  const directory = await mkdtemp(join(tmpdir(), "smarthire-job-catalogue-"));
  directories.push(directory);
  const filePath = join(directory, "jobs.json");
  await writeFile(
    filePath,
    `${JSON.stringify([buildJobReviewSnapshot()], null, 2)}\n`,
    "utf8",
  );
  const lease = new FakeLeaseCoordinator();
  const repository = new JsonJobCatalogueRepository<
    ReturnType<typeof buildJobReviewSnapshot>
  >({
    filePath,
    mode,
    writerHostId: mode === "writer" ? "writer-fixture-1" : null,
    leaseCoordinator: lease,
    leaseTtlMs: 30_000,
  });
  return { directory, filePath, lease, repository };
}

describe("JSON job catalogue repository", () => {
  it("fails closed on a read-only host and serializes a fenced atomic replacement", async () => {
    const readonly = await fixture("readonly");
    await expect(readonly.repository.mutate((jobs) => jobs)).rejects.toThrow(
      "JOB_CATALOGUE_READ_ONLY",
    );

    const { filePath, repository } = await fixture();
    await repository.mutate((jobs) => [{ ...jobs[0], title: "Updated title" }]);
    expect(JSON.parse(await readFile(filePath, "utf8"))[0].title).toBe(
      "Updated title",
    );
  });

  it("rejects stale fencing and leaves the valid catalogue plus no temporary file", async () => {
    const { directory, filePath, lease, repository } = await fixture();
    const before = await readFile(filePath, "utf8");
    lease.rejectOwnership = true;
    await expect(repository.mutate((jobs) => jobs.slice(0, 1))).rejects.toThrow(
      "JOB_CATALOGUE_LEASE_LOST",
    );
    expect(await readFile(filePath, "utf8")).toBe(before);
    expect(
      (await readdir(directory)).filter((name) => name.includes(".tmp")),
    ).toEqual([]);
  });

  it("rejects malformed input and checksum changes without replacing data", async () => {
    const malformed = await fixture();
    await writeFile(malformed.filePath, "{not-json", "utf8");
    await expect(malformed.repository.read()).rejects.toThrow(
      "JOB_CATALOGUE_MALFORMED",
    );

    const conflict = await fixture();
    await expect(
      conflict.repository.mutate(async (jobs) => {
        await writeFile(conflict.filePath, "[]\n", "utf8");
        return jobs;
      }),
    ).rejects.toThrow("JOB_CATALOGUE_CHECKSUM_CONFLICT");
  });
});
