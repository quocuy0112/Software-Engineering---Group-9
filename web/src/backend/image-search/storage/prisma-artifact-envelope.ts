import "server-only";

import { prisma } from "@/backend/database/prisma";

type ArtifactEnvelopeRow = Readonly<{
  storageLocator: string | null;
  authenticationTagHex: string | null;
  plaintextSha256Hex: string;
  plaintextBytes: number;
}>;

export async function readSearchArtifactEnvelope(artifactId: string) {
  const rows = await prisma.$queryRaw<ArtifactEnvelopeRow[]>`
    SELECT "storageLocator",
           encode("authenticationTag", 'hex') AS "authenticationTagHex",
           encode("plaintextSha256", 'hex') AS "plaintextSha256Hex",
           "plaintextBytes"
      FROM "SearchStoredArtifact"
     WHERE "id" = ${artifactId}
     LIMIT 1`;
  const row = rows[0];
  return row
    ? {
        storageLocator: row.storageLocator,
        authenticationTag: row.authenticationTagHex
          ? Buffer.from(row.authenticationTagHex, "hex")
          : null,
        plaintextSha256: Buffer.from(row.plaintextSha256Hex, "hex"),
        plaintextBytes: row.plaintextBytes,
      }
    : null;
}
