import { describe, expect, it, vi } from "vitest";
import { createAdminOperationIdController } from "@/frontend/features/admin/shared/admin-operation-id";

describe("admin operation id", () => {
  it("stays stable across double-submit, step-up, timeout, and retry", () => {
    const generate = vi
      .fn()
      .mockReturnValueOnce("operation-1")
      .mockReturnValueOnce("operation-2");
    const operation = createAdminOperationIdController(generate);
    expect(operation.begin()).toBe("operation-1");
    expect(operation.current()).toBe("operation-1");
    expect(operation.current()).toBe("operation-1");
    expect(generate).toHaveBeenCalledOnce();
    operation.complete();
    expect(operation.begin()).toBe("operation-2");
  });

  it("creates a new id after an explicit cancel", () => {
    let sequence = 0;
    const operation = createAdminOperationIdController(
      () => `operation-${++sequence}`,
    );
    expect(operation.begin()).toBe("operation-1");
    operation.cancel();
    expect(operation.begin()).toBe("operation-2");
  });
});
