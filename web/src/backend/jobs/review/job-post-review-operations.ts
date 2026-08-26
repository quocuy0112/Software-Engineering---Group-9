import "server-only";

type ReviewOperation =
  | "queue_read"
  | "integrity_block"
  | "stale_conflict"
  | "decision";

export function emitJobPostReviewOperation(input: {
  operation: ReviewOperation;
  outcome: "success" | "denied" | "failure";
  correlationId: string;
  durationMs: number;
  code?: string;
  version?: number;
  queueAgeSeconds?: number;
}) {
  console.info("job_post_review_operation", {
    operation: input.operation,
    outcome: input.outcome,
    correlationId: input.correlationId,
    durationClass:
      input.durationMs < 250
        ? "lt_250ms"
        : input.durationMs < 1_000
          ? "lt_1s"
          : input.durationMs < 2_000
            ? "lt_2s"
            : "gte_2s",
    code: input.code,
    version: input.version,
    queueAgeSeconds: input.queueAgeSeconds,
  });
}
