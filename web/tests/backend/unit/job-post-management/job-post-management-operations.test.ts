import { afterEach, describe, expect, it } from "vitest";
import {
  emitJobPostManagementOperation,
  setJobPostManagementOperationSinkForTest,
} from "@/backend/jobs/management/job-post-management-operations";

describe("job post management operations", () => {
  afterEach(() => setJobPostManagementOperationSinkForTest(() => undefined));

  it("emits bounded operational metadata without request payloads", () => {
    const received: unknown[] = [];
    setJobPostManagementOperationSinkForTest((event) => received.push(event));
    emitJobPostManagementOperation({
      operation: "hide",
      outcome: "success",
      correlationId: "correlation-id",
      durationMs: 12,
    });
    expect(received).toEqual([
      {
        operation: "hide",
        outcome: "success",
        correlationId: "correlation-id",
        durationMs: 12,
        affectedCount: 1,
      },
    ]);
  });
});
