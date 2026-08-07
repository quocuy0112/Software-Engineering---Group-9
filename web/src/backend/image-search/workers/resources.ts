export interface ClockPort {
  now(): Date;
}

export interface StagePort<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface WorkRepositoryPort<Claim, Commit> {
  claim(input: { owner: string; now: Date; limit: number }): Promise<Claim[]>;
  commit(input: Commit): Promise<"COMMITTED" | "STALE_DISCARDED">;
}

export interface AdmissionReadinessPort {
  assertAdmissionReady(now: Date): Promise<void>;
}

export type ImageSearchWorkerPorts<
  ScanInput,
  ScanOutput,
  NormalizeInput,
  NormalizeOutput,
  OcrInput,
  OcrOutput,
  InterpretInput,
  InterpretOutput,
  Storage,
  Repositories,
> = Readonly<{
  scanner: StagePort<ScanInput, ScanOutput>;
  normalizer: StagePort<NormalizeInput, NormalizeOutput>;
  ocr: StagePort<OcrInput, OcrOutput>;
  interpreter: StagePort<InterpretInput, InterpretOutput>;
  storage: Storage;
  repositories: Repositories;
  clock: ClockPort;
  admissionReadiness: AdmissionReadinessPort;
}>;

export type ImageSearchWorkerResourceFactory<Configuration, Resources> = (
  configuration: Configuration,
) => Promise<Resources>;
