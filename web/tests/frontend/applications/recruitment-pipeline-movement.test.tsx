import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("pipeline movement presentation", () => {
  it("shares one command path between pointer movement and explicit stage control", () => {
    const board = readFileSync("src/frontend/features/recruiter-applications/recruitment-pipeline-board.tsx", "utf8");
    const card = readFileSync("src/frontend/features/recruiter-applications/recruitment-pipeline-card.tsx", "utf8");
    const dialog = readFileSync("src/frontend/features/recruiter-applications/application-stage-change-dialog.tsx", "utf8");
    expect(board).toContain("DndContext");
    expect(board).toContain("onDragCancel");
    expect(card).toMatch(/Change Stage/i);
    expect(dialog).toContain("allowedDestinations");
  });
});
