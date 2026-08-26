import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/frontend/components/ui/button";
import { CollapsibleCard } from "@/frontend/components/ui/collapsible-card";
import { ContentTabs } from "@/frontend/components/ui/content-tabs";
import { RelatedJobRow } from "@/frontend/components/ui/related-job-row";
import { StatChip } from "@/frontend/components/ui/stat-chip";

describe("Job detail UI primitives", () => {
  it("exposes the shared outline button variant", () => {
    render(<Button variant="outline">Visit company website</Button>);

    expect(
      screen.getByRole("button", { name: "Visit company website" }),
    ).toHaveClass("sh-button--outline");
  });

  it("keeps the reusable stat chip structure stable", () => {
    render(<StatChip icon={<span>◎</span>} label="Age" value="38 – 43" />);

    expect(screen.getByText("Age")).toBeVisible();
    expect(screen.getByText("38 – 43")).toBeVisible();
    expect(document.querySelector(".sh-stat-chip__icon")).toBeTruthy();
  });

  it("supports disclosure with aria state and Enter/Space", () => {
    render(
      <CollapsibleCard
        title="Company info"
        persistentContent={<p>Unity Trading Co.</p>}
        defaultExpanded
      >
        <p>Company details</p>
      </CollapsibleCard>,
    );

    const trigger = screen.getByRole("button", { name: "Company info" });
    const content = screen
      .getByText("Company details")
      .closest(".sh-collapsible-card__content");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(content).toHaveAttribute("aria-hidden", "false");

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Unity Trading Co.")).toBeVisible();

    fireEvent.keyDown(trigger, { key: " " });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps content tabs separate and keyboard navigable", () => {
    const onChange = vi.fn();
    render(
      <ContentTabs
        tabs={[
          { id: "description", label: "Job description" },
          { id: "requirements", label: "Requirements" },
        ]}
        activeIndex={0}
        onChange={onChange}
        panelId="panel"
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("renders a compact related row with a labeled save control", () => {
    const onToggleSave = vi.fn();
    render(
      <RelatedJobRow
        compact
        avatarLabel="UT"
        title="Brand Manager"
        company="Unity Trading Co."
        location="Long Thanh District"
        salaryRange="51 – 56.5 million/month"
        saved={false}
        onToggleSave={onToggleSave}
      />,
    );

    const save = screen.getByRole("button", { name: "Save job" });
    expect(save).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(save);
    expect(onToggleSave).toHaveBeenCalledTimes(1);
  });
});
