export declare const RECRUITER_HEADER_PROTOCOL: Readonly<{
  accountMinimum: number;
  accountsPerState: number;
  warmups: number;
  measured: number;
  concurrency: number;
  refreshResultsPerState: number;
  triggerResults: number;
  triggerResultCellMinimum: number;
  triggerResultCellMaximum: number;
  intervalMinimumMs: number;
}>;

export declare function validateRecruiterHeaderMeasurement(
  measurement: unknown,
): {
  ok: boolean;
  errors: string[];
  stateCounts: Record<string, number>;
};
