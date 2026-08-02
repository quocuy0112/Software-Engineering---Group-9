export type CvScannerSocketMetadata = Readonly<{
  isSocket(): boolean;
  uid: number;
  gid: number;
  mode: number;
}>;

export function validateCvScannerSocketMetadata(
  metadata: CvScannerSocketMetadata,
  workerGroups?: readonly number[],
): void;

export function validateCvScannerVersion(version: string, now?: Date): void;

export function checkCvScanner(options?: { now?: Date }): Promise<
  Readonly<{
    engine: "1.4.5";
    transport: "unix";
    signatureFresh: true;
  }>
>;
