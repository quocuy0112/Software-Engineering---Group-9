# Home Page Display Model

Home adds no database table or migration. These non-persistent presentation
models are assembled from existing authorized sources or feature-local curated
display content.

## HomePageModel

| Field | Description |
| --- | --- |
| `locale` | Initial `vi` or `en` Home presentation locale from existing preference or public default. |
| `viewer` | Discriminated `GuestViewer`, `CandidateViewer`, or `EmployerViewer` safe context. |
| `sections` | Ordered independently stateful section records. |
| `content` | Typed, immutable curated bilingual feed/path/growth/event/footer content. |

## Viewer variants

| Viewer | Fields and rules |
| --- | --- |
| `GuestViewer` | Login/register actions; no identity, shortcuts, saved state, membership, or personal score; illustrative Smart Match only. |
| `CandidateViewer` | Safe display name/image fallback; dashboard/applications/saved shortcuts; personal match only when the existing profile is sufficient and a valid existing result is available; current save/logout security proof remains inside its existing action boundary. |
| `EmployerViewer` | Safe display identity plus existing recruiter-status Post a Job state: loading, unavailable, disabled pending, or ready destination. Illustrative Smart Match only; no candidate profile signals or personal job-card scores. |

## Section state

```text
HomeSectionState<T> =
  | { status: "loading"; label: LocalizedText }
  | { status: "ready"; items: readonly T[] }
  | { status: "empty"; title: LocalizedText; action?: HomeLink }
  | { status: "error"; title: LocalizedText; recovery: ScopedRetry | ReloadHome };
```

Initial server composition normally returns ready, empty, or error. Loading is
used only by an independent refresh boundary. `ReloadHome` is labelled as a
whole-page reload rather than a section-only retry. Errors contain no actor,
membership, provider, raw failure, or stack details.

## Source models

| Model | Fields and limits | Source |
| --- | --- | --- |
| `TrendingJob` | Existing public job subset: id/slug/title/company/location/arrangement/up to 5 skills/actions, plus optional valid current-candidate personal score. Up to 6. | Existing job discovery. |
| `EmployerSpotlight` | Required `slug` and `displayName`; optional `logoUrl`, `publicDescription`, `publicLocation`, `industry`, `size`, and authoritative `openPositionCount`; explicit `destination: { kind: "displayOnly" }`. No culture or badges with the current schema. Up to 6. | Independent read-only projection of active verified companies. Never derived from Trending jobs. |
| `SmartMatchInsight` | Candidate-facing job-fit recommendation discriminated as `personal` or `illustrative`; score, matching skills, improvement areas, limitations, and estimate wording. `personal` is valid only for a sufficient-profile authenticated candidate with a valid existing job-recommendation result. It is not applicant screening. | Existing deterministic Job Discovery profile match projection or fixed labelled illustration. |
| `FeedItem` | Career post/company hiring/guidance, title, summary, display-only label. At most 3. | Curated local content. |
| `CareerPath` | Exactly the approved six paths; display-only. | Curated local content. |
| `GrowthResource` / `CareerEvent` | Required category, title, summary, display-only label; no registration or engagement state. | Curated local content. |
| `HomeSearchCriteria` | Keyword, location, work arrangement, employment type, experience level, and skills only. | In-memory Home form, validated against existing job discovery. |

## Personal Smart Match projection

```text
HomeSmartMatch =
  | {
      kind: "personal";
      jobSlug: string;
      score: number;
      matchingSkills: readonly string[];
      improvementAreas: readonly string[]; // at most 3 missing job skills
      isEstimate: true;
    }
  | {
      kind: "illustrative";
      score: number;
      matchingSkills: readonly string[];
      improvementAreas: readonly string[];
      isEstimate: true;
    };
```

`personal` is legal only when the current authenticated candidate profile is not
empty, contains at least one skill, experience, or location signal, and the
existing deterministic helper returns a valid result over bounded public Home
jobs. `illustrative` is static localized presentation and is never joined to a
real job or exposed as a job-card score.

This projection ranks jobs for the current candidate. It never ranks candidates
for an employer and is separate from the constitutional hybrid applicant-
screening score.

## Invariants

- Home owns no new persistence and invokes only existing save/logout actions.
- Better Auth remains the exclusive browser-session owner; Home models contain
  no cookie/token and do not create, persist, or revoke sessions locally.
- Guest and expired-session models never contain identity, personal score,
  saved/application state, membership, shortcut, token, or private identifier.
- Employer models never contain candidate-specific profile signals, matching
  skills/gaps, or personal job-card scores.
- Illustrative scores never populate job-card scores.
- The current Company schema supplies no authoritative culture or badge fields,
  so those fields are absent. Position count is present only from a complete
  public-job relation count, never from Home's bounded Trending list.
- Save UI is transient; existing save outcome is authoritative and failure
  restores the previous state.
- Locale changes only presentation and preserves viewer state plus keyword,
  location, arrangement, employment, experience, and skill values exactly.
- All Home-authored visible and assistive text comes from one centralized
  bilingual catalog; underlying job/company record text remains unchanged.
