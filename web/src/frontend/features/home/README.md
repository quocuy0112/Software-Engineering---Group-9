# Smart Hire Home

The feature composes one public Home route for guests, candidates, and employers.

- Jobs reuse the existing public Job Discovery and Saved Job boundaries.
- Candidate Smart Match reuses the existing deterministic, profile-backed job
  recommendation. It ranks jobs for the current candidate and is not applicant
  screening, a hiring decision, or the separate constitutional 60/40 score.
- Companies Hiring uses an independent read-only projection of verified public
  companies with active positions. Counts come from the same active-job rules.
- Account state reuses Better Auth, Profile, and recruiter-status boundaries.
  Home creates no session, role, company URL, or authorization decision.
- Career Paths, workflow, and candidate-trust content use the bilingual Home
  catalog; company cards are derived from current public job data.

Out of scope: new Home APIs or migrations, a matching/recommendation engine,
matching persistence, CMS publishing, social interactions, event registration,
payments/orders, chat, AI CV parsing, video interviews, job-application or
job-post workflows, recruiter administration, pipelines, and a complete
recruitment-management system.
