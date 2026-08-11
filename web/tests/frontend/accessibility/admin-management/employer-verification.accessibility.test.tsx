import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProtectedEvidenceViewer } from "@/frontend/features/admin/verification/protected-evidence-viewer";

describe("employer verification accessibility", () => {
  it("has no serious or critical violations in an inaccessible-evidence state", async () => {
    const { container } = render(
      <ProtectedEvidenceViewer
        requestId="r1"
        evidenceId="e1"
        mediaType="application/pdf"
        accessible={false}
      />,
    );
    const axe = (await import("axe-core")).default;
    const result = await axe.run(container);
    expect(
      result.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? ""),
      ),
    ).toEqual([]);
  });
});
