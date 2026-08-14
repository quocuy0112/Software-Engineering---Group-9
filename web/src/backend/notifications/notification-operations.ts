import "server-only";

type NotificationOperation =
  | "create"
  | "list"
  | "unread-count"
  | "mark-read"
  | "mark-all-read"
  | "mark-context-read"
  | "retention";

type NotificationOutcome = "success" | "failure";

export type NotificationOperationEvent = {
  operation: NotificationOperation;
  outcome: NotificationOutcome;
  correlationId?: string;
  durationMs?: number;
  affectedCount?: number;
  errorCode?: string;
};

const bounded = (value: string | undefined, maximum: number) =>
  value?.replace(/[^a-zA-Z0-9:_-]/gu, "_").slice(0, maximum);

export function emitNotificationOperation(event: NotificationOperationEvent) {
  console.info(
    JSON.stringify({
      scope: "in-app-notification",
      operation: event.operation,
      outcome: event.outcome,
      ...(event.correlationId
        ? { correlationId: bounded(event.correlationId, 128) }
        : {}),
      ...(typeof event.durationMs === "number"
        ? { durationMs: Math.max(0, Math.round(event.durationMs)) }
        : {}),
      ...(typeof event.affectedCount === "number"
        ? { affectedCount: Math.max(0, Math.trunc(event.affectedCount)) }
        : {}),
      ...(event.errorCode
        ? { errorCode: bounded(event.errorCode, 64) }
        : {}),
    }),
  );
}
