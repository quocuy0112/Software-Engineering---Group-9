import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImageSearchConsent } from "@/frontend/features/jobs/image-search/components/image-search-consent";
import { ImageSearchInput } from "@/frontend/features/jobs/image-search/components/image-search-input";
import { ImageSearchProgress } from "@/frontend/features/jobs/image-search/components/image-search-progress";
import { ImageSearchProposals } from "@/frontend/features/jobs/image-search/components/image-search-proposals";
import { ImageSearchRecovery } from "@/frontend/features/jobs/image-search/components/image-search-recovery";
import { ImageSearchFeedback } from "@/frontend/features/jobs/image-search/components/image-search-feedback";
import {
  GlobalImageSearch,
  jobTextSearchHref,
} from "@/frontend/features/jobs/image-search/components/global-image-search";
import type { SearchIntent } from "@/shared/contracts/jobs/search-intent";
import { WorkspaceLocaleProvider } from "@/frontend/features/dashboard/client/workspace-locale";
import type { JobSearchTaxonomy } from "@/shared/contracts/jobs/taxonomy";

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

const intent: SearchIntent = {
  schemaVersion: "job-search-intent-v1",
  language: "EN",
  warnings: [],
  proposals: [
    {
      id: "occupation-1",
      field: "q",
      stringValue: "Digital Marketing Specialist",
      numberValue: null,
      stringValues: [],
      confidence: 0.82,
      basis: "INFERRED",
      evidence: [
        {
          startCodePoint: 15,
          endCodePoint: 34,
          text: "optimize paid media",
        },
      ],
      selected: false,
      selectionReason: "USER_SELECTION_REQUIRED",
    },
    {
      id: "remote-1",
      field: "workArrangement",
      stringValue: null,
      numberValue: null,
      stringValues: ["REMOTE"],
      confidence: 0.98,
      basis: "NORMALIZED",
      evidence: [{ startCodePoint: 0, endCodePoint: 6, text: "Remote" }],
      selected: true,
      selectionReason: "AUTO_NORMALIZED",
    },
    {
      id: "location-1",
      field: "location",
      stringValue: "Da Nang",
      numberValue: null,
      stringValues: [],
      confidence: 0.72,
      basis: "INFERRED",
      evidence: [{ startCodePoint: 7, endCodePoint: 14, text: "Da Nang" }],
      selected: false,
      selectionReason: "USER_SELECTION_REQUIRED",
    },
  ],
};

const taxonomy: JobSearchTaxonomy = {
  industries: [
    {
      code: "r01",
      name: "Sales & Business Development",
      count: 4,
      subIndustries: [
        {
          name: "B2B Sales",
          count: 4,
          titles: [
            {
              name: "Key Account Manager",
              categoryIds: ["r01-b2b-sales"],
              count: 2,
            },
            {
              name: "Account Executive",
              categoryIds: ["r01-b2b-sales"],
              count: 1,
            },
          ],
        },
      ],
    },
  ],
  locations: [
    { label: "Ho Chi Minh City", value: "Ho Chi Minh City", count: 4 },
    {
      label: "Ho Chi Minh City · District 1",
      value: "District 1, Ho Chi Minh City",
      count: 2,
    },
  ],
};

describe("image-assisted job-search controls", () => {
  it("keeps an English text-and-camera search bar available in the global header", () => {
    window.history.replaceState(null, "", "/jobs?q=Sidebar%20keyword");
    render(<GlobalImageSearch />);

    expect(
      screen.getByRole("search", { name: "Global job search" }),
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText("Search jobs, skills, or companies"),
    ).toHaveValue("Sidebar keyword");
    expect(
      screen.getByRole("button", { name: "Search jobs from an image" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Search jobs" })).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Search jobs from an image" }),
    );
    const file = screen.getByLabelText("Job poster image");
    expect(file).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(file).toBeEnabled();
    window.history.replaceState(null, "", "/");
  });

  it("keeps the complete image-search panel in Vietnamese when selected", () => {
    window.history.replaceState(null, "", "/jobs");
    render(
      <WorkspaceLocaleProvider initialLocale="vi">
        <GlobalImageSearch />
      </WorkspaceLocaleProvider>,
    );

    expect(
      screen.getByPlaceholderText("Tìm công việc, kỹ năng hoặc công ty"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Tìm việc bằng hình ảnh" }),
    );
    expect(screen.getByText("Đồng ý xử lý hình ảnh (bắt buộc)")).toBeVisible();
    expect(
      screen.getByText("Hình ảnh được xử lý riêng tư và tạm thời"),
    ).toBeVisible();
  });

  it("moves the existing search controls into the workspace toolbar when docked", () => {
    const headerSlot = document.createElement("div");
    headerSlot.id = "workspace-job-search-slot";
    document.body.append(headerSlot);
    let unmount: (() => void) | undefined;

    try {
      ({ unmount } = render(
        <GlobalImageSearch taxonomy={taxonomy} dockToWorkspaceHeader />,
      ));

      expect(headerSlot.querySelector('[role="search"]')).not.toBeNull();
      expect(headerSlot.querySelector("#global-image-search")).not.toBeNull();
    } finally {
      unmount?.();
      headerSlot.remove();
    }
  });

  it("replaces only the keyword and keeps active filters from the header", () => {
    expect(
      jobTextSearchHref(
        "https://smarthire.test/jobs?q=old&location=Da%20Nang&workArrangement=REMOTE&cursor=next",
        "product designer",
      ),
    ).toBe("/jobs?q=product+designer&location=Da+Nang&workArrangement=REMOTE");
    expect(
      jobTextSearchHref(
        "https://smarthire.test/jobs?q=old&location=Da%20Nang&workArrangement=REMOTE",
        "product designer",
        "Ha Noi",
      ),
    ).toBe("/jobs?q=product+designer&location=Ha+Noi&workArrangement=REMOTE");
  });

  it("shows a server-derived category flyout and location choices", () => {
    render(<GlobalImageSearch taxonomy={taxonomy} />);

    fireEvent.click(screen.getByRole("button", { name: "Job Category" }));
    expect(
      screen.getAllByText("Sales & Business Development").at(0),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: /b2b sales/i })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /key account manager/i }),
    ).toBeVisible();
    expect(screen.getByLabelText("Location")).toHaveDisplayValue(
      "All locations",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Job categories" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Job Category" })).toHaveFocus();
  });

  it("opens and changes job categories only when clicked", () => {
    const clickTaxonomy: JobSearchTaxonomy = {
      ...taxonomy,
      industries: [
        {
          ...taxonomy.industries[0]!,
          name: "Marketing / PR / Advertising / Communications",
          count: 428,
        },
        {
          code: "r03",
          name: "Information Technology (IT)",
          count: 2,
          subIndustries: [
            {
              name: "Software Engineering",
              count: 2,
              titles: [
                {
                  name: "Software Engineer",
                  categoryIds: ["r03-software-engineering"],
                  count: 2,
                },
              ],
            },
          ],
        },
      ],
    };
    render(<GlobalImageSearch taxonomy={clickTaxonomy} />);

    const trigger = screen.getByRole("button", { name: "Job Category" });
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("dialog", { name: "Job categories" })).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const technology = screen.getByRole("button", {
      name: /information technology.*2 open roles/i,
    });
    fireEvent.mouseEnter(technology);
    expect(
      document.querySelector(".job-category-detail-title"),
    ).toHaveTextContent("Marketing / PR / Advertising / Communications");
    expect(technology).toHaveAttribute("data-active", "false");
    expect(technology.closest("li")).toHaveClass("job-category-industry-item");

    fireEvent.click(technology);
    expect(technology).toHaveAttribute("aria-pressed", "true");
    expect(technology).toHaveAttribute("data-active", "true");
    expect(
      document.querySelector(".job-category-detail-title"),
    ).toHaveTextContent("Information Technology (IT)");
  });

  it("closes the category flyout from its close control or an outside click", () => {
    render(<GlobalImageSearch taxonomy={taxonomy} />);
    const trigger = screen.getByRole("button", { name: "Job Category" });

    fireEvent.click(trigger);
    fireEvent.click(
      screen.getByRole("button", { name: "Close job categories" }),
    );
    expect(screen.queryByRole("dialog", { name: "Job categories" })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "Job categories" })).toBeNull();
  });

  it("renders every industry supplied by the precomputed taxonomy", () => {
    const allIndustries: JobSearchTaxonomy = {
      ...taxonomy,
      industries: Array.from({ length: 28 }, (_, index) => ({
        ...taxonomy.industries[0]!,
        code: `r${String(index + 1).padStart(2, "0")}`,
        name: `Industry ${String(index + 1).padStart(2, "0")}`,
      })),
    };
    render(<GlobalImageSearch taxonomy={allIndustries} />);

    fireEvent.click(screen.getByRole("button", { name: "Job Category" }));
    expect(screen.getAllByRole("button", { name: /^Industry /u })).toHaveLength(
      28,
    );
  });

  it("keeps exactly one in-flow active row while selecting all 28 categories", () => {
    const allIndustries: JobSearchTaxonomy = {
      ...taxonomy,
      industries: Array.from({ length: 28 }, (_, index) => ({
        ...taxonomy.industries[0]!,
        code: `r${String(index + 1).padStart(2, "0")}`,
        name: `Industry ${String(index + 1).padStart(2, "0")}`,
      })),
    };
    render(<GlobalImageSearch taxonomy={allIndustries} />);
    fireEvent.click(screen.getByRole("button", { name: "Job Category" }));

    for (let index = 1; index <= 28; index += 1) {
      const category = screen.getByRole("button", {
        name: new RegExp(`^Industry ${String(index).padStart(2, "0")}`, "u"),
      });
      fireEvent.click(category);
      expect(category).toHaveAttribute("data-active", "true");
      expect(
        document.querySelectorAll('.job-category-industry[data-active="true"]'),
      ).toHaveLength(1);
    }
  });

  it("accepts a PNG/JPEG file through the accessible labeled input", () => {
    const onSelect = vi.fn();
    render(<ImageSearchInput disabled={false} onSelect={onSelect} />);
    const file = new File([Buffer.from("image")], "poster.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Job poster image"), {
      target: { files: [file] },
    });
    expect(onSelect).toHaveBeenCalledWith(file);
    expect(screen.getByText(/up to 5 MB/u)).toBeVisible();
    expect(screen.getByText(/maximum 20 MP/u)).toBeVisible();
  });

  it("shows provenance and confidence while supporting edit, reverse, remove, and clear", () => {
    const onApply = vi.fn();
    render(
      <ImageSearchProposals
        intent={intent}
        onApply={onApply}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("High confidence")).toBeVisible();
    expect(screen.getAllByText("Review suggested")).toHaveLength(2);
    expect(
      screen.getByText(/This may be a “Digital Marketing Specialist” role/u),
    ).toBeVisible();
    expect(screen.getByText("Job title or keyword")).toBeVisible();
    expect(screen.getByText(/Source: Remote/u)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Edit location proposal"), {
      target: { value: "Hanoi" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reverse selections" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Apply selected filters" }),
    );
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        proposals: expect.arrayContaining([
          expect.objectContaining({
            id: "location-1",
            stringValue: "Hanoi",
            selected: true,
          }),
        ]),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove location" }));
    expect(
      screen.queryByLabelText("Edit location proposal"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear proposals" }));
    expect(
      screen.queryByLabelText("Edit workArrangement proposal"),
    ).not.toBeInTheDocument();
  });

  it("keeps cancel, manual fallback, and initially-off external consent explicit", () => {
    const cancel = vi.fn();
    const manual = vi.fn();
    const consent = vi.fn();
    const { rerender } = render(
      <>
        <ImageSearchConsent selected={false} onChange={consent} />
        <ImageSearchProgress progress={42} onCancel={cancel} />
        <ImageSearchRecovery
          error="OCR unavailable"
          fallbackReason={null}
          onRetry={vi.fn()}
          onManual={manual}
        />
      </>,
    );
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(consent).toHaveBeenCalledWith(true);
    expect(screen.getByRole("status")).toHaveTextContent("42%");
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel image search" }),
    );
    expect(cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Search manually" }));
    expect(manual).toHaveBeenCalledWith();

    rerender(
      <ImageSearchRecovery
        error={null}
        fallbackReason="INTERPRETER_UNAVAILABLE"
        onRetry={vi.fn()}
        onManual={manual}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "AI filter suggestions are unavailable",
      }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Recognized job poster text"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use as keyword search" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to Find jobs" }),
    );
    expect(manual).toHaveBeenLastCalledWith();
  });

  it("uses error, warning, and success toasts for image-search outcomes", () => {
    vi.clearAllMocks();
    const { rerender } = render(
      <ImageSearchFeedback
        phase="ERROR"
        error="Image search is temporarily unavailable."
        fallbackReason={null}
        retryAt={null}
        proposalCount={0}
        warningCount={0}
      />,
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Image search could not continue",
      expect.objectContaining({
        description: "Image search is temporarily unavailable.",
      }),
    );

    rerender(
      <ImageSearchFeedback
        phase="FALLBACK"
        error={null}
        fallbackReason="INTERPRETER_UNAVAILABLE"
        retryAt={null}
        proposalCount={0}
        warningCount={0}
      />,
    );
    expect(toast.warning).toHaveBeenCalledWith(
      "AI filter suggestions are unavailable",
      expect.any(Object),
    );

    rerender(
      <ImageSearchFeedback
        phase="READY"
        error={null}
        fallbackReason={null}
        retryAt={null}
        proposalCount={2}
        warningCount={0}
      />,
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Job filters are ready",
      expect.objectContaining({ description: expect.stringContaining("2") }),
    );
  });
});
