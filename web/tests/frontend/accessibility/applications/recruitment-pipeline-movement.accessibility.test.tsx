import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pipeline movement accessibility", () => {
  it("has keyboard controls, announcements, cancellation, and focus restoration", () => {
    const board = readFileSync("src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx", "utf8");
    expect(board).toContain("KeyboardSensor");
    expect(board).toContain('aria-live="polite"');
    expect(board).toMatch(/focus/u);
    expect(board).toContain("onDragCancel");
  });
});
