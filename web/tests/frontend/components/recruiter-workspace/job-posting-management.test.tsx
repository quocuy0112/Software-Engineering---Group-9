import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecruiterJobPostingManagement } from "@/frontend/features/recruiter-workspace/job-posting-management";
import type { RecruiterJobManagementData } from "@/shared/contracts/recruiter-job-posting";

const initialData: RecruiterJobManagementData = {
  companyId: "company-1",
  companies: [
    {
      id: "company-1",
      slug: "northstar-labs",
      name: "Northstar Labs",
      logo: null,
      size: "51-200 employees",
      industry: "Technology",
      address: "Ho Chi Minh City",
      website: null,
      description: "A product company.",
      ownerUserId: "recruiter-1",
    },
  ],
  jobs: [
    {
      id: "job-1",
      slug: "senior-product-designer-job-1",
      companyId: "company-1",
      title: "Senior Product Designer",
      shortPitch: "Design the next generation of hiring tools.",
      industry: "Technology",
      industryCode: "technology",
      subIndustry: "Product design",
      categoryIds: ["product-design"],
      categoryFamily: "product",
      skillTags: ["Figma", "Product design"],
      location: {
        city: "Ho Chi Minh City",
        district: "District 1",
        isNationwideRemote: false,
      },
      salary: {
        min: 45_000_000,
        max: 65_000_000,
        currency: "VND",
        period: "month",
        isNegotiable: false,
      },
      experience: { minYears: 5, label: "5+ years" },
      level: "senior",
      employmentType: "full_time",
      workArrangement: "hybrid",
      workOnSaturday: false,
      education: "Bachelor's degree",
      age: "",
      numberOfHires: 1,
      status: "active",
      isUrgent: false,
      isVerified: true,
      postedAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-07T00:00:00.000Z",
      applyDeadline: "2026-09-14T00:00:00.000Z",
      description: {
        overview: "Shape thoughtful experiences for hiring teams.",
        topReasonsToJoin: [],
        responsibilities: ["Own end-to-end product design."],
        requirements: ["Strong product design experience."],
        benefits: [],
        generalInfo: {
          reportsTo: null,
          department: "Product & Design",
          workingHours: null,
          workAddress: null,
        },
      },
      stats: { viewCount: 100, applicantCount: 48 },
      company: {
        id: "company-1",
        slug: "northstar-labs",
        name: "Northstar Labs",
        logo: null,
        size: "51-200 employees",
        industry: "Technology",
        address: "Ho Chi Minh City",
        website: null,
        description: "A product company.",
        ownerUserId: "recruiter-1",
      },
    },
  ],
};

describe("recruiter job posting management", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows live overview metrics and opens the structured editor", () => {
    render(<RecruiterJobPostingManagement initialData={initialData} />);

    expect(screen.getByText("Active jobs")).toBeVisible();
    expect(screen.getByText("Total applicants")).toBeVisible();
    expect(screen.getByRole("tab", { name: /Active1/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: /48 Applicants/ })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Edit posting" }));

    expect(
      screen.getByRole("heading", {
        name: "Senior Product Designer",
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getByText("Live candidate preview")).toBeVisible();
    expect(screen.getByText("Required skills")).toBeVisible();
    expect(screen.getByText("Preferred skills")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  });

  it("blocks submission and identifies missing required fields", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RecruiterJobPostingManagement initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Submit for approval" }),
    );

    expect(screen.getByText("Enter a job title.")).toBeVisible();
    expect(screen.getByText("Add a short pitch.")).toBeVisible();
    expect(screen.getByText("Add a role overview.")).toBeVisible();
    expect(screen.getByText("Choose an application deadline.")).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a complete posting with a populated sub-industry", async () => {
    const createdJob = {
      ...initialData.jobs[0],
      id: "job-created",
      title: "Frontend Engineer",
      subIndustry: "Software development",
      status: "pending_approval" as const,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdJob), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<RecruiterJobPostingManagement initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));
    fireEvent.change(screen.getByLabelText(/Job title/), {
      target: { value: "Frontend Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Short pitch/), {
      target: { value: "Build reliable candidate experiences." },
    });
    fireEvent.change(screen.getByLabelText(/Sub-industry/), {
      target: { value: "Software development" },
    });
    fireEvent.change(screen.getByLabelText(/Overview/), {
      target: {
        value: "Own the frontend experience from discovery to delivery.",
      },
    });
    fireEvent.change(screen.getByLabelText(/Application deadline/), {
      target: { value: "2099-12-31" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit for approval" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as {
      status: string;
      job: { subIndustry: string };
    };
    expect(payload.status).toBe("pending_approval");
    expect(payload.job.subIndustry).toBe("Software development");
    expect(
      await screen.findByText("Job posting saved to the mock database."),
    ).toBeVisible();
  });

  it("disables creation when no recruiter-owned company is linked", () => {
    render(
      <RecruiterJobPostingManagement
        initialData={{ jobs: [], companies: [], companyId: null }}
      />,
    );

    expect(screen.getByText("Company setup required")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Create job posting" }),
    ).toBeDisabled();
  });
  it("extends a closing-soon active job without closing it", async () => {
    const deadline = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const closingJob = { ...initialData.jobs[0], applyDeadline: deadline };
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        const update = JSON.parse(String(init?.body)) as typeof closingJob;
        return new Response(
          JSON.stringify({
            ...closingJob,
            ...update,
            company: closingJob.company,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <RecruiterJobPostingManagement
        initialData={{ ...initialData, jobs: [closingJob] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Extend deadline" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as {
      status: string;
      applyDeadline: string;
    };
    expect(request.method).toBe("PATCH");
    expect(payload.status).toBe("active");
    expect(new Date(payload.applyDeadline).getTime()).toBeGreaterThan(
      new Date(deadline).getTime(),
    );
    expect(
      await screen.findByText("Application deadline extended by 30 days."),
    ).toBeVisible();
  });
  it("provides a progress indicator and independently collapsible sections", () => {
    render(<RecruiterJobPostingManagement initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));

    expect(
      screen.getByRole("progressbar", { name: "Job posting completion" }),
    ).toHaveAttribute("aria-valuemax", "6");
    const basicSummary = screen.getByText("Basic info").closest("summary");
    const locationSummary = screen
      .getByText("Location & work arrangement")
      .closest("summary");
    expect(basicSummary?.parentElement).toHaveAttribute("open");
    expect(locationSummary?.parentElement).toHaveAttribute("open");

    fireEvent.click(basicSummary!);
    expect(basicSummary?.parentElement).not.toHaveAttribute("open");
    expect(locationSummary?.parentElement).toHaveAttribute("open");
  });
  it("formats salary input live, validates the range, and mirrors it in preview", () => {
    render(<RecruiterJobPostingManagement initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));

    const minimum = screen.getByLabelText(/Minimum salary/);
    const maximum = screen.getByLabelText(/Maximum salary/);
    fireEvent.change(minimum, { target: { value: "29000000" } });
    fireEvent.change(maximum, { target: { value: "33000000" } });

    expect(minimum).toHaveValue("29.000.000");
    expect(maximum).toHaveValue("33.000.000");
    expect(screen.getByText("29,000,000 - 33,000,000 VND/month")).toBeVisible();

    fireEvent.change(maximum, { target: { value: "20000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(
      screen.getByText(
        "Maximum salary must be greater than or equal to minimum salary.",
      ),
    ).toBeVisible();
  });

  it("persists the expanded jobs.json fields as structured values", async () => {
    const createdJob = {
      ...initialData.jobs[0],
      id: "job-expanded",
      status: "draft" as const,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createdJob), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<RecruiterJobPostingManagement initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));

    fireEvent.change(screen.getByLabelText(/Job title/), {
      target: { value: "Platform Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/Short pitch/), {
      target: { value: "Build the foundation for reliable hiring." },
    });
    fireEvent.change(screen.getByLabelText(/Overview/), {
      target: { value: "Own platform reliability and developer experience." },
    });
    fireEvent.change(screen.getByLabelText(/Minimum salary/), {
      target: { value: "29tr" },
    });
    fireEvent.change(screen.getByLabelText(/Maximum salary/), {
      target: { value: "33tr" },
    });
    fireEvent.change(screen.getByLabelText(/Age range/), {
      target: { value: "24-35" },
    });
    fireEvent.change(screen.getByLabelText(/Number of hires/), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText(/Responsibilities/), {
      target: {
        value: "Own platform reliability\nImprove deployment workflows",
      },
    });
    fireEvent.change(screen.getByLabelText(/Requirements/), {
      target: { value: "Strong TypeScript\nCloud infrastructure experience" },
    });
    fireEvent.change(screen.getByLabelText(/Working hours/), {
      target: { value: "Monday-Friday, 9:00-18:00" },
    });
    fireEvent.change(screen.getByLabelText(/Work address/), {
      target: { value: "District 1, Ho Chi Minh City" },
    });
    fireEvent.click(screen.getByLabelText("Holiday and Tet bonus"));
    fireEvent.click(screen.getByLabelText(/Urgent hiring/));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(request.body)) as {
      job: (typeof initialData.jobs)[0];
    };
    expect(payload.job.salary).toMatchObject({
      min: 29_000_000,
      max: 33_000_000,
      isNegotiable: true,
    });
    expect(payload.job.age).toBe("24-35");
    expect(payload.job.numberOfHires).toBe(3);
    expect(payload.job.isUrgent).toBe(true);
    expect(payload.job.description.responsibilities).toEqual([
      "Own platform reliability",
      "Improve deployment workflows",
    ]);
    expect(payload.job.description.requirements).toEqual([
      "Strong TypeScript",
      "Cloud infrastructure experience",
    ]);
    expect(payload.job.description.benefits).toContainEqual({
      icon: "gift",
      label: "Holiday and Tet bonus",
    });
    expect(payload.job.description.generalInfo).toMatchObject({
      workingHours: "Monday-Friday, 9:00-18:00",
      workAddress: "District 1, Ho Chi Minh City",
    });
  });
  it("supports typing the 29tr salary shorthand one character at a time", () => {
    render(<RecruiterJobPostingManagement initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));

    const minimum = screen.getByLabelText(/Minimum salary/);
    fireEvent.change(minimum, { target: { value: "2" } });
    fireEvent.change(minimum, { target: { value: "29" } });
    fireEvent.change(minimum, { target: { value: "29t" } });
    expect(minimum).toHaveValue("29t");
    fireEvent.change(minimum, { target: { value: "29tr" } });

    expect(minimum).toHaveValue("29.000.000");
    expect(screen.getByText("From 29,000,000 VND/month")).toBeVisible();
  });
  it("exposes every jobs.json field and updates the structured candidate preview", () => {
    render(<RecruiterJobPostingManagement initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "Create job posting" }));

    expect(screen.getByLabelText(/Minimum years/)).toBeVisible();
    expect(screen.getByLabelText(/Job level/)).toBeVisible();
    expect(screen.getByLabelText(/Education/)).toBeVisible();
    expect(screen.getByLabelText(/Age range/)).toBeVisible();
    expect(screen.getByLabelText(/Number of hires/)).toBeVisible();
    expect(screen.getByLabelText(/Work on Saturday/)).toBeVisible();
    expect(screen.getByLabelText(/Nationwide remote/)).toBeVisible();
    expect(screen.getByLabelText(/Urgent hiring/)).toBeVisible();
    expect(screen.getByLabelText(/Top reason 1/)).toBeVisible();
    expect(screen.getByLabelText(/Responsibilities/)).toBeVisible();
    expect(screen.getByLabelText(/Requirements/)).toBeVisible();
    expect(screen.getByLabelText(/Reports to/)).toBeVisible();
    expect(screen.getByLabelText(/Working hours/)).toBeVisible();
    expect(screen.getByLabelText(/Work address/)).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Minimum years/), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText(/Experience label/), {
      target: { value: "3+ years" },
    });
    fireEvent.change(screen.getByLabelText(/Reports to/), {
      target: { value: "Head of Engineering" },
    });
    fireEvent.change(screen.getByLabelText(/Top reason 1/), {
      target: { value: "Own meaningful product decisions" },
    });

    const preview = screen.getByText("Live candidate preview").closest("aside");
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("3+ years")).toBeVisible();
    expect(within(preview!).getByText("Head of Engineering")).toBeVisible();
    expect(
      within(preview!).getByText("Own meaningful product decisions"),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Age range/), {
      target: { value: "23-30" },
    });
    fireEvent.change(screen.getByLabelText(/Number of hires/), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByLabelText(/Nationwide remote/));
    fireEvent.click(screen.getByLabelText(/Work on Saturday/));
    fireEvent.click(screen.getByLabelText(/Urgent hiring/));
    fireEvent.click(screen.getByLabelText("Holiday and Tet bonus"));

    expect(within(preview!).getByText("23-30")).toBeVisible();
    expect(within(preview!).getByText("4")).toBeVisible();
    expect(within(preview!).getByText("Nationwide")).toBeVisible();
    expect(within(preview!).getByText("Required")).toBeVisible();
    expect(within(preview!).getByText("Urgent hiring")).toBeVisible();
    expect(within(preview!).getByText("Holiday and Tet bonus")).toBeVisible();
  });
});
