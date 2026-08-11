import "server-only";
export type StoredEvidence = { storageAdapter: string; storageLocator: string; encryptionKeyVersion: number; iv: string; authenticationTag: string; sourceSha256: string; byteSize: number };
export interface PrivateBusinessEvidenceStorage { write(reference: string, bytes: Buffer): Promise<StoredEvidence>; read(locator: string, metadata: { iv: string; authenticationTag: string; encryptionKeyVersion: number }): Promise<Buffer>; delete(locator: string): Promise<void>; }
export class EvidenceStorageError extends Error { constructor(public readonly code: "UNAVAILABLE" | "INTEGRITY_FAILED") { super(code); } }
