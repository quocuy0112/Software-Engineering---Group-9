type JobPostManagementOperation = {
  operation: string;
  outcome: "success" | "failure";
  correlationId: string;
  durationMs: number;
  affectedCount?: number;
};

type OperationSink = (event: JobPostManagementOperation) => void;

let sink: OperationSink = (event) => {
  console.info(JSON.stringify({ scope: "job-post-management", ...event }));
};

export function emitJobPostManagementOperation(
  event: JobPostManagementOperation,
) {
  sink({ ...event, affectedCount: event.affectedCount ?? 1 });
}

export function setJobPostManagementOperationSinkForTest(next: OperationSink) {
  sink = next;
}
