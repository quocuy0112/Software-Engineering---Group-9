import Link from "next/link";

type SearchCriteria = Partial<Record<string, string | string[] | number>>;

const one = (value: SearchCriteria[string]) =>
  Array.isArray(value) ? (value[0] ?? "") : (value?.toString() ?? "");

export function JobSearchForm({ criteria }: { criteria: SearchCriteria }) {
  return (
    <form
      className="job-panel job-filter-form"
      role="search"
      aria-label="Job search"
      action="/jobs"
    >
      <header className="job-filter-heading">
        <span className="job-filter-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </span>
        <div>
          <p className="panel-kicker">REFINE SEARCH</p>
          <h2>Filters</h2>
        </div>
      </header>
      <p className="job-filter-copy">
        Narrow the list using one or more criteria.
      </p>
      <div className="job-filter-fields">
        <label>
          Keywords
          <input
            name="q"
            type="search"
            maxLength={200}
            defaultValue={one(criteria.q)}
            placeholder="Title, skill, or company"
          />
        </label>
        <label>
          Location
          <input
            name="location"
            maxLength={160}
            defaultValue={one(criteria.location)}
            placeholder="Ho Chi Minh City"
          />
        </label>
        <label>
          Employment type
          <select
            name="employmentType"
            defaultValue={one(criteria.employmentType)}
          >
            <option value="">Any</option>
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="TEMPORARY">Temporary</option>
          </select>
        </label>
        <label>
          Experience level
          <select
            name="experienceLevel"
            defaultValue={one(criteria.experienceLevel)}
          >
            <option value="">Any</option>
            <option value="ENTRY">Entry</option>
            <option value="JUNIOR">Junior</option>
            <option value="MID">Mid-level</option>
            <option value="SENIOR">Senior</option>
            <option value="LEAD">Lead</option>
            <option value="MANAGER">Manager</option>
          </select>
        </label>
        <label>
          Work arrangement
          <select
            name="workArrangement"
            defaultValue={one(criteria.workArrangement)}
          >
            <option value="">Any</option>
            <option value="ONSITE">On-site</option>
            <option value="HYBRID">Hybrid</option>
            <option value="REMOTE">Remote</option>
          </select>
        </label>
        <label>
          Minimum salary (VND/month)
          <input
            name="salaryMin"
            type="number"
            min="0"
            defaultValue={one(criteria.salaryMin)}
          />
        </label>
        <label>
          Maximum salary (VND/month)
          <input
            name="salaryMax"
            type="number"
            min="0"
            defaultValue={one(criteria.salaryMax)}
          />
        </label>
        <label>
          Skill
          <input
            name="skills"
            maxLength={80}
            defaultValue={one(criteria.skills)}
            placeholder="TypeScript"
          />
        </label>
        <label>
          Posted within
          <select
            name="postedWithinDays"
            defaultValue={one(criteria.postedWithinDays)}
          >
            <option value="">Any time</option>
            <option value="1">24 hours</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={one(criteria.sort) || "RELEVANCE"}>
            <option value="RELEVANCE">Relevance</option>
            <option value="NEWEST">Newest</option>
            <option value="SALARY_DESC">Highest salary</option>
          </select>
        </label>
      </div>
      <input type="hidden" name="salaryCurrency" value="VND" />
      <input type="hidden" name="salaryPeriod" value="MONTH" />
      <div className="job-filter-actions">
        <button className="job-primary-button" type="submit">
          Search jobs
        </button>
        <Link className="job-secondary-link" href="/jobs">
          Clear all
        </Link>
      </div>
    </form>
  );
}
