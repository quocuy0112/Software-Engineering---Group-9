"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { JobDetail } from "@/shared/contracts/jobs/discovery";
import {
  jobCategories,
  jobBenefits,
  jobMustHaveRequirements,
  jobNiceToHaveRequirements,
  jobOverview,
  jobResponsibilities,
  jobSkills,
} from "./job-detail-data";

export type JobDetailSectionId =
  | "description"
  | "requirements"
  | "benefits"
  | "company";

const benefitIcon: Record<string, string> = {
  award: "★",
  bonus: "$",
  calendar: "◷",
  car: "↗",
  coffee: "•",
  dollar: "$",
  "dollar-sign": "$",
  globe: "◉",
  heart: "♡",
  health: "+",
  insurance: "+",
  learning: "↗",
  "book-open": "↗",
  shield: "✓",
  spark: "✦",
  users: "◉",
};

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="job-section-muted">
        More details will be shared by the hiring team.
      </p>
    );
  }

  return (
    <ul className="job-detail-bullet-list">
      {items.map((item, index) => (
        <li key={item + "-" + index}>
          <span className="job-bullet-marker" aria-hidden="true">
            ✓
          </span>
          <BulletContent item={item} />
        </li>
      ))}
    </ul>
  );
}

function BulletContent({ item }: { item: string }) {
  const match = item.match(/^(.{2,70}?)(?::|-)\s+(.+)$/u);

  return match ? (
    <span>
      <strong>{match[1]}</strong> {match[2]}
    </span>
  ) : (
    <span>{item}</span>
  );
}

function InlineChips({
  items,
  label,
  ariaLabel,
}: {
  items: string[];
  label: string;
  ariaLabel: string;
}) {
  if (!items.length) return null;

  return (
    <div className="job-detail-inline-chip-group">
      <p className="job-detail-inline-chip-label">{label}</p>
      <ul className="job-detail-inline-chips" aria-label={ariaLabel}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  headingId,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  headingId: string;
}) {
  return (
    <div className="job-detail-section-heading">
      <p className="panel-kicker">{eyebrow}</p>
      <h2 id={headingId}>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

function AccordionSection({
  id,
  eyebrow,
  title,
  copy,
  defaultOpen = false,
  children,
}: {
  id: JobDetailSectionId;
  eyebrow: string;
  title: string;
  copy: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const headingId = id + "-heading";
  const contentId = id + "-content";

  return (
    <section
      id={id}
      className={
        "job-detail-section-card job-detail-accordion-item" +
        (isOpen ? " is-open" : "")
      }
      aria-labelledby={headingId}
    >
      <h2 className="job-detail-accordion-heading" id={headingId}>
        <button
          className="job-detail-accordion-trigger"
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="job-detail-accordion-trigger-copy">
            <span className="panel-kicker">{eyebrow}</span>
            <span className="job-detail-accordion-title">{title}</span>
            <span className="job-detail-accordion-summary">{copy}</span>
          </span>
          <span className="job-detail-accordion-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </h2>
      <div
        id={contentId}
        className="job-detail-accordion-content"
        hidden={!isOpen}
      >
        {children}
      </div>
    </section>
  );
}

export function JobDetailOverview({ job }: { job: JobDetail }) {
  const facts = [
    {
      label: "Experience",
      value:
        job.experienceMinYears !== undefined
          ? job.experienceMinYears + "+ years"
          : "Not listed",
    },
    {
      label: "Age",
      value: job.age?.trim() || "Not listed",
    },
    {
      label: "Education level",
      value: job.education?.trim() || "Not listed",
    },
  ];
  const specialization = jobCategories(job);

  return (
    <section
      id="overview"
      className="job-detail-section-card job-detail-overview-card"
      aria-labelledby="overview-heading"
    >
      <div className="job-detail-overview-header">
        <SectionHeading
          headingId="overview-heading"
          eyebrow="OVERVIEW"
          title="Overview"
          copy="The essentials at a glance before you dive into the role."
        />
        <Link className="job-similar-jobs-link" href="/jobs">
          Send me similar jobs
        </Link>
      </div>

      <div
        className="job-overview-facts"
        aria-label="Job requirements at a glance"
      >
        {facts.map((fact) => (
          <div className="job-overview-fact" key={fact.label}>
            <span className="job-overview-fact-label">{fact.label}</span>
            <span className="job-detail-tag">{fact.value}</span>
          </div>
        ))}
      </div>

      <div className="job-overview-specialization">
        <p className="job-detail-inline-chip-label">Specialization</p>
        {specialization.length ? (
          <ul
            className="job-detail-inline-chips"
            aria-label="Job specialization"
          >
            {specialization.slice(0, 10).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <span className="job-detail-tag">Not listed</span>
        )}
      </div>
    </section>
  );
}

function DescriptionSection({ job }: { job: JobDetail }) {
  return (
    <AccordionSection
      id="description"
      eyebrow="01 / THE ROLE"
      title="Job description"
      copy="A clear view of the work, expectations, and impact you can make."
      defaultOpen
    >
      <div className="job-detail-section-copy">
        <p>{jobOverview(job)}</p>
      </div>
      <InlineChips
        items={jobSkills(job).slice(0, 8)}
        label="Role focus"
        ariaLabel="Role focus skills"
      />
      <div className="job-detail-section-subblock">
        <h3 id="responsibilities-heading">Key responsibilities</h3>
        <BulletList items={jobResponsibilities(job)} />
      </div>
    </AccordionSection>
  );
}

function RequirementsSection({ job }: { job: JobDetail }) {
  const mustHave = jobMustHaveRequirements(job);
  const niceToHave = jobNiceToHaveRequirements(job);

  return (
    <AccordionSection
      id="requirements"
      eyebrow="02 / YOUR EDGE"
      title="Requirements"
      copy="The signals that will help you do well in this role."
    >
      <div className="job-detail-accordion-intro">
        <h3>Candidate requirements</h3>
        <p>The signals that will help you do well in this role.</p>
      </div>
      <InlineChips
        items={jobSkills(job)}
        label="Required skills"
        ariaLabel="Required skills"
      />
      <div className="job-requirement-columns">
        <div>
          <h3>Must-have requirements</h3>
          <BulletList items={mustHave} />
        </div>
        <div className="job-requirement-nice">
          <h3>Nice-to-have</h3>
          {niceToHave.length ? (
            <BulletList items={niceToHave} />
          ) : (
            <p className="job-section-muted">
              No additional nice-to-have requirements were provided.
            </p>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}

function BenefitsSection({ job }: { job: JobDetail }) {
  const benefits = jobBenefits(job);

  return (
    <AccordionSection
      id="benefits"
      eyebrow="03 / THE PACKAGE"
      title="Benefits"
      copy="The full package, kept together so you can compare with confidence."
    >
      {benefits.length ? (
        <ul className="job-benefit-grid" aria-label="Job benefits">
          {benefits.map((benefit, index) => (
            <li key={benefit.label + "-" + index}>
              <span className="job-benefit-icon" aria-hidden="true">
                {benefitIcon[benefit.icon.toLowerCase()] ?? "✦"}
              </span>
              <span>{benefit.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="job-section-muted">
          Benefits details will be shared during the interview process.
        </p>
      )}
    </AccordionSection>
  );
}
export function JobDetailSections({
  job,
  includeOverview = true,
}: {
  job: JobDetail;
  section?: JobDetailSectionId;
  includeOverview?: boolean;
}) {
  return (
    <div className="job-detail-sections" aria-label="Job details">
      {includeOverview ? <JobDetailOverview job={job} /> : null}
      <DescriptionSection job={job} />
      <RequirementsSection job={job} />
      <BenefitsSection job={job} />
    </div>
  );
}
