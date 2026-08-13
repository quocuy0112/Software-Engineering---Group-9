# Smart Hire Home first-visit protocol

Status: Ready to conduct; no participant evidence recorded yet.

## Participants and environment

- Recruit at least 10 job seekers: a balanced mix of students/fresh graduates
  and experienced candidates.
- Recruit at least 10 employer participants who are eligible to represent an
  organization and understand job-posting needs.
- Do not count project-team members or repeat participants.
- Cover at least desktop 1366×768, tablet 768×1024, and mobile 390×844; record
  the actual browser, device, language, and authentication state per session.
- Start each participant on `/` with no coaching about the page structure.

## Tasks and measurements

1. Show the Home page for five seconds, hide it, then ask the participant to
   explain what Smart Hire is. Mark success only when they independently
   mention suitable job discovery and either employers or career community.
2. Ask job seekers to begin a search using a role/skill, location, and one
   additional filter. Measure from prompt completion to reaching `/jobs` with
   the intended criteria. The task succeeds on the first attempt within 30
   seconds without moderator direction.
3. Ask employer participants to find how they would post a job. Measure from
   prompt completion to the existing login/verification/recruiter destination.
   The task succeeds on the first attempt within 30 seconds without moderator
   direction; disabled pending/unavailable status is a correct outcome when it
   matches the participant's seeded recruiter state.
4. Ask each participant what a Smart Match score means. Success requires them
   to describe it as an estimate/recommendation and not a hiring decision.

## Recording and thresholds

- Record participant ID, cohort, device, locale, auth/role state, first action,
  completion time, first-attempt result, errors, assistance, and verbatim
  interpretation notes without collecting unnecessary personal data.
- SC-001 passes when at least 90% correctly explain the proposition after five
  seconds.
- SC-002 passes when at least 90% of job seekers complete search on the first
  attempt within 30 seconds.
- SC-003 passes when at least 90% of eligible employers reach the correct Post
  a Job boundary on the first attempt within 30 seconds.
- Report cohort and aggregate rates. A missing cohort, fewer than 10 eligible
  participants in either cohort, or a below-threshold result stays open and is
  never replaced by automated test evidence.
