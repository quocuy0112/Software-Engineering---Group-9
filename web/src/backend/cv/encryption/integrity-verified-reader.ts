import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, type Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type {
  CvArtifactEncryptionContext,
  CvArtifactEnvelope,
} from "./artifact-cryptor";
import type { PrivateCvStorage } from "../storage/private-cv-storage";

export class CvArtifactIntegrityError extends Error {
  readonly name = "CvArtifactIntegrityError";
  readonly code = "ARTIFACT_INTEGRITY_FAILED";

  constructor() {
    super("ARTIFACT_INTEGRITY_FAILED");
  }

  toJSON() {
    return { name: this.name, code: this.code };
  }
}

export type IntegrityVerifiedArtifact = Readonly<{
  plaintextBytes: number;
  sha256: string;
  open(): AsyncIterable<Uint8Array>;
  dispose(): Promise<void>;
}>;

type Cryptor = Readonly<{
  decrypt(input: {
    ciphertext: AsyncIterable<Uint8Array>;
    plaintext: Writable;
    context: CvArtifactEncryptionContext;
    envelope: Pick<
      CvArtifactEnvelope,
      "keyVersion" | "iv" | "authenticationTag"
    >;
  }): Promise<Readonly<{ ciphertextBytes: number; plaintextBytes: number }>>;
}>;

type ArtifactDescriptor = Readonly<{
  locator: string;
  ciphertextBytes: number;
  plaintextBytes: number;
  plaintextSha256: Uint8Array;
  context: CvArtifactEncryptionContext;
  envelope: Pick<CvArtifactEnvelope, "keyVersion" | "iv" | "authenticationTag">;
}>;

export class IntegrityVerifiedReader {
  constructor(
    private readonly dependencies: Readonly<{
      storage: PrivateCvStorage;
      cryptor: Cryptor;
      denyAndScheduleDeletion(input: {
        artifactId: string;
        uploadId: string;
        reason: "ARTIFACT_INTEGRITY_FAILED";
      }): Promise<void>;
    }>,
  ) {}

  async verify(input: ArtifactDescriptor): Promise<IntegrityVerifiedArtifact> {
    const directory = await mkdtemp(join(tmpdir(), "smarthire-cv-verified-"));
    const filename = join(directory, "artifact.bin");
    const digest = createHash("sha256");
    const plaintext = new PassThrough();
    plaintext.on("data", (chunk: Buffer) => digest.update(chunk));
    const writePromise = pipeline(
      plaintext,
      createWriteStream(filename, { flags: "wx", mode: 0o600 }),
    );
    try {
      const counts = await this.dependencies.cryptor.decrypt({
        ciphertext: this.dependencies.storage.open(
          input.locator,
          input.ciphertextBytes,
        ),
        plaintext,
        context: input.context,
        envelope: input.envelope,
      });
      plaintext.end();
      await writePromise;
      const actualDigest = digest.digest();
      const expectedDigest = Buffer.from(input.plaintextSha256);
      const digestMatches =
        expectedDigest.byteLength === actualDigest.byteLength &&
        timingSafeEqual(expectedDigest, actualDigest);
      const countMatches =
        counts.ciphertextBytes === input.ciphertextBytes &&
        counts.plaintextBytes === input.plaintextBytes;
      if (!digestMatches || !countMatches) throw new CvArtifactIntegrityError();
      let disposed = false;
      return Object.freeze({
        plaintextBytes: counts.plaintextBytes,
        sha256: actualDigest.toString("hex"),
        open: () => {
          if (disposed) throw new CvArtifactIntegrityError();
          return createReadStream(filename);
        },
        dispose: async () => {
          if (disposed) return;
          disposed = true;
          await rm(directory, { recursive: true, force: true });
        },
      });
    } catch (error) {
      plaintext.destroy();
      await writePromise.catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
      await this.dependencies.denyAndScheduleDeletion({
        artifactId: input.context.artifactId,
        uploadId: input.context.uploadId,
        reason: "ARTIFACT_INTEGRITY_FAILED",
      });
      if (error instanceof CvArtifactIntegrityError) throw error;
      throw new CvArtifactIntegrityError();
    }
  }
}
