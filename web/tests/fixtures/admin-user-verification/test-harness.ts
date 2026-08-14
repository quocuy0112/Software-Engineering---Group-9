export type FailureBoundary =
  | "account-update"
  | "session-revoke"
  | "challenge-consume"
  | "audit"
  | "rationale"
  | "notification"
  | "outbox";

export function failurePlan(failure?: FailureBoundary) {
  return {
    shouldFail(boundary: FailureBoundary) {
      if (boundary === failure) throw new Error(`INJECTED_${boundary}`);
    },
  };
}

export function captureNotificationPayloads() {
  const payloads: unknown[] = [];
  return {
    payloads,
    capture(payload: unknown) {
      payloads.push(payload);
    },
  };
}
