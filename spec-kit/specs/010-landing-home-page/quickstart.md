# Home Page Validation Quickstart

## Prerequisites

- Work on `010-landing-home-page` at repository root.
- Configure the existing development environment from `web/.env.example`.
- When needed, seed public jobs with the existing job seed command.
- Do not treat a seeded job subset as authoritative Employer Spotlight evidence.

## Run locally

```powershell
npm --prefix web run dev
```

Open `http://localhost:3001/`; `/home` must redirect to `/`.

## End-to-end checks

1. As guest, verify shared section order, Login/Sign up, no private output,
   centralized bilingual presentation, illustrative Smart Match, and localized
   save-to-login behavior.
2. As a sufficient-profile Candidate, verify avatar/name/logout,
   Dashboard/Applications/Saved shortcuts, genuine existing Smart Match, valid
   personal job-card score only, and save success/failure recovery.
3. As an insufficient-profile Candidate and as an employer, verify labelled
   illustrative Smart Match and no personal job-card score or candidate-specific
   match data.
4. Verify Post a Job follows existing recruiter status: pending/loading/
   unavailable has no guessed target; eligible status uses only its resolved
   destination.
5. Enter keyword, location, work arrangement, employment type, experience level,
   and skills; change language and confirm every value remains; submit and verify
   `/jobs` contains only validated approved criteria.
6. Verify Explore Jobs uses `/jobs`; Career Community, Companies, and Events use
   `#community`, `#employer-spotlight`, and `#events`; all curated and spotlight
   cards are explicitly display-only.
7. Verify each spotlight field comes from the active verified public-company
   allowlist. The current schema supports public identity/summary/location/
   industry/size but no authoritative culture or Hybrid/Mentoring/
   Internship-friendly badge, so those claims must be absent. Accept an
   open-position count only from a complete public-job relation count, never the
   six Home jobs.
8. Simulate independent Jobs and Company loading/empty/error states. Confirm
   localized messages and source-scoped recovery, or an explicit Reload Home
   label for whole-page recovery, while unrelated controls remain usable.
9. Expire a session and verify guest presentation appears with no stale identity,
   shortcut, saved state, personal match, membership, or security proof.
10. Verify Home session creation remains outside Home, session validation uses
    the existing server boundary, logout uses `POST /api/identity/logout`, its
    successful audit event remains present, and no token/cookie value reaches
    rendered or client-managed Home state.
11. Verify personal Smart Match is described as a candidate-facing job-fit
    recommendation rather than applicant screening; it does not claim to use or
    replace the separate constitutional 60/40 screening formula.
12. At desktop/tablet/mobile widths and 200% zoom, complete bilingual navigation,
    compact menu, search, CTA, save/login, and logout keyboard-only; assert
    semantic headings, visible focus, reduced motion, no overlap, and no
    horizontal scroll.

## Automated checks

```powershell
npm --prefix web run typecheck
npm --prefix web run lint:home
npm --prefix web run test:home
npm --prefix web run test:home:e2e
npm --prefix web run test:home:performance
npm --prefix web run lint
npm --prefix web run test -- --exclude "tests/performance/home/**"
npm --prefix web run test:e2e
```

`typecheck`, `lint:home`, and `test:home` are the focused implementation gate in
T079. `test:home` includes Home unit, component, integration, accessibility,
security/privacy, and architecture tests; it excludes Playwright and the
performance harness. `test:home:e2e` is the Home browser matrix.
`test:home:performance` uses its separate Chromium performance configuration
and must not be inferred from any fast test. The final three commands are the
repository-wide lint, non-Home-performance Vitest regression, and default
Playwright regression in T080. Record each exact command's date, scope, count,
and result in `release-validation.md`; unexecuted or blocked checks stay open.

## References

- [Specification](./spec.md)
- [Plan](./plan.md)
- [Display model](./data-model.md)
- [Interface contract](./contracts/home-page-contract.md)
