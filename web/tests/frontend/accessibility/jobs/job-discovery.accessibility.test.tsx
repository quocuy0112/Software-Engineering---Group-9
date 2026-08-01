import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobSearchForm } from "@/frontend/features/jobs/components/job-search-form";

describe("job discovery accessibility", () => {
  it("groups filters and labels every control", () => {
    render(<JobSearchForm criteria={{}} />);
    expect(screen.getByRole("search", { name: /job search/i })).toBeVisible();
    expect(screen.getByLabelText(/keywords/i)).toBeVisible();
    expect(screen.getByLabelText(/location/i)).toBeVisible();
    expect(screen.getByLabelText(/employment type/i)).toBeVisible();
    expect(screen.getByLabelText(/work arrangement/i)).toBeVisible();
    expect(screen.getByLabelText(/sort/i)).toBeVisible();
  });
});
