"use client";

export function createAdminOperationIdController(
  generate: () => string = () => crypto.randomUUID(),
) {
  let operationId: string | null = null;
  return {
    begin() {
      operationId ??= generate();
      return operationId;
    },
    current() {
      operationId ??= generate();
      return operationId;
    },
    complete() {
      operationId = null;
    },
    cancel() {
      operationId = null;
    },
  };
}
