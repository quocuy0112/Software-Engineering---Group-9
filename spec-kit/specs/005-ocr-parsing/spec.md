# Feature Specification: Purpose-Specific OCR Parsing

**Feature Branch**: `005-ocr-parsing`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Create a new additive OCR feature with two
purpose-specific flows: extract text from images inside Candidate PDF/DOCX CVs
before the existing parser and review workflow, and accept ephemeral PNG/JPEG
images in the global job-search interface so OCR and AI can derive visible,
editable structured filters for deterministic job retrieval."

## Clarifications

### Session 2026-08-06

- Q: How should Candidate CV extraction handle a PDF page with sufficient native
  text that appears suspicious or materially disagrees with rendered content? →
  A: OCR pages with insufficient text and pages identified as suspicious; flag
  material native/OCR conflicts for Candidate review.
- Q: Who may submit image-search queries, and what limits apply? → A: Visitors
  may submit 3 image queries per rolling hour under both IP and browser limits;
  authenticated users may submit 10 per rolling hour per account.
- Q: Which AI-generated search criteria may be applied automatically? → A: Only
  high-confidence explicit or meaning-preserving normalized criteria; broader
  or low-confidence inferences remain visibly labeled, unselected suggestions.
- Q: Which DOCX regions are eligible for OCR? → A: Only supported images
  referenced from the main document body; headers, footers, footnotes, comments,
  and other non-body regions are excluded.
- Q: Where may recognized search text remain when AI interpretation fails? → A:
  Only in the current in-memory browser interaction; the server copy is deleted
  immediately, and reload, navigation, cancellation, or a newer query discards
  the browser copy.
- Q: What must happen when a Candidate revisits an external-AI CV import after
  confirmation? A: The confirmed import remains readable through its persisted
  upload identifier and exposes its immutable receipt without draft content. The
  status projection does not issue a new consent challenge after the temporary
  content becomes inaccessible.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Import Image-Bearing CV Documents (Priority: P1)

As an authenticated Candidate, I can upload an otherwise supported PDF or DOCX
CV that contains scanned pages or text-bearing images and receive a reviewable
draft that includes both machine-readable and recognized visual text without
changing my Candidate Profile before I confirm it.

**Why this priority**: Image-only and mixed-content CVs are a current recovery
case even though they use the already approved PDF/DOCX upload formats. Closing
this gap makes the existing CV-import workflow useful for common scanned and
designed CVs while preserving its security and human-review boundaries.

**Independent Test**: Upload clean supported PDF and DOCX fixtures containing
native text, image text, or both; verify that every eligible page or document
image is accounted for in document order, a bounded draft is produced or an
actionable outcome is shown, Candidate Profile remains unchanged, and a direct
standalone image CV upload is still rejected.

**Acceptance Scenarios**:

1. **Given** a clean image-only PDF within the existing CV limits, **When** its
   pages contain recognizable Vietnamese, English, or bilingual text, **Then**
   the system recognizes the page text, preserves page order and provenance,
   and submits the resulting segments to the existing CV parser and review
   workflow.
2. **Given** a clean PDF containing both sufficient machine-readable pages and
   pages with insufficient or suspicious machine-readable text, **When**
   extraction runs, **Then** native text remains preferred, only insufficient or
   suspicious pages use visual recognition, material native/OCR conflicts are
   flagged for Candidate review, no page is silently omitted, and duplicate text
   is not added to the draft.
3. **Given** a clean DOCX containing ordinary paragraphs and supported
   text-bearing images referenced from the main document body, **When**
   extraction runs, **Then** native paragraphs and recognized image text are
   combined in their best available reading order with source provenance.
4. **Given** a CV contains low-confidence or unreadable visual text, **When**
   processing finishes, **Then** uncertain content is clearly identified for
   Candidate review or the Candidate receives an actionable replacement,
   retry, or manual-entry path rather than silently incomplete profile data.
5. **Given** a Candidate attempts to upload a standalone PNG or JPEG as a CV,
   **When** the upload is validated, **Then** it is rejected and the existing
   PDF/DOCX-only CV boundary remains unchanged.
6. **Given** a Candidate confirms an EXTERNAL_OPENAI CV import, **When** the
   Candidate returns to import status, **Then** the status and confirmation receipt
   remain available through the canonical upload identifier without a new consent
   challenge, while the editable draft route remains unavailable after confirmation.

---

### User Story 2 - Find Jobs from an Image Query (Priority: P1)

As a visitor or authenticated user, I can attach one PNG or JPEG to the global
search interface, have its visible text interpreted as job-search intent, and
receive active job results through the existing deterministic search while
seeing and controlling every generated keyword and filter.

**Why this priority**: A job poster, screenshot, or photographed notice often
contains useful search criteria that would be slow and error-prone to retype.
The feature provides semantic convenience without allowing AI to select or rank
jobs.

**Independent Test**: Submit representative Vietnamese, English, and bilingual
job-poster images as both a visitor and an authenticated user; verify that
validated filter chips appear, can be edited and removed, produce the same jobs
as equivalent manual criteria, reveal no non-public records, and leave ordinary
text search available throughout processing.

**Acceptance Scenarios**:

1. **Given** a valid job-poster PNG or JPEG, **When** image interpretation
   completes, **Then** high-confidence explicit or meaning-preserving normalized
   keywords and filters are applied to the existing job search and
   simultaneously shown as editable and removable controls, while broader or
   low-confidence inferences remain labeled and unselected.
2. **Given** the same intended criteria are entered manually and derived from an
   image, **When** both searches execute, **Then** the deterministic search
   produces the same result set and ordering under the same availability state.
3. **Given** AI proposes an unsupported, invalid, or unevidenced criterion,
   **When** the search intent is validated, **Then** that criterion cannot affect
   the search, valid criteria remain available, and the user receives clear
   correction or fallback controls.
4. **Given** generated filters have been applied, **When** the user edits,
   removes, or clears them, **Then** the search immediately uses only the visible
   current criteria without requiring another image upload.
5. **Given** a matching posting is pending, rejected, removed, future, closed,
   expired, outside its publication window, or otherwise unauthorized, **When**
   image-assisted search runs, **Then** it is excluded under the same rules as
   ordinary Feature 003 search.
6. **Given** a visitor or authenticated user has exhausted the applicable
   rolling-hour image-query limit, **When** another image query is attempted,
   **Then** it is rejected before expensive processing, an accessible retry time
   is shown, and ordinary text search remains available.

---

### User Story 3 - Recover Without OCR or AI (Priority: P2)

As a Candidate or job-search user, I can continue the underlying workflow when
visual recognition or AI interpretation is unavailable, slow, uncertain, or
unsuccessful, without losing existing native extraction or manual-search
capabilities.

**Why this priority**: OCR and AI are probabilistic dependencies. They must add
value without making CV management or public job discovery depend on their
availability.

**Independent Test**: Inject timeouts, provider unavailability, invalid output,
low confidence, cancellation, and stale-result delivery into both purposes;
verify that CV Profile data remains unchanged, manual CV recovery and ordinary
text search remain usable, and late results cannot overwrite current user
choices.

**Acceptance Scenarios**:

1. **Given** native CV text is sufficient, **When** OCR is unavailable, **Then**
   the existing native extraction and review flow continues without an OCR
   dependency.
2. **Given** a CV requires OCR and no trustworthy result is available, **When**
   bounded attempts end, **Then** the Candidate receives the existing permitted
   retry, replacement-upload, and manual Profile-entry paths without any direct
   Profile mutation.
3. **Given** an image-search query has produced OCR text but AI interpretation
   is unavailable, **When** the user continues, **Then** the user can review or
   edit the extracted text in the current browser interaction and submit it
   through ordinary deterministic text search; the server copy is deleted
   immediately and the browser copy does not survive reload or navigation.
4. **Given** OCR itself fails for a search image, **When** the failure is shown,
   **Then** the global search remains enabled for manual text and the source
   image is deleted under the same short retention deadline.
5. **Given** a user changes criteria, cancels processing, or starts a newer
   image query, **When** an older result arrives, **Then** the stale result cannot
   replace or merge into the user's current visible search state.

---

### User Story 4 - Control Sensitive Image Processing (Priority: P2)

As a user, I understand the purpose and destination of image processing, retain
control over external processing when applicable, and can trust that temporary
search images and OCR text are not reused or retained as CV, Profile,
application, analytics, or search-index data.

**Why this priority**: CVs and user-supplied images may contain personal data.
Purpose separation, consent, deletion, and safe observability are mandatory even
when the visible feature is only a convenience interaction.

**Independent Test**: Exercise internal and external processing policies,
consent grant and refusal, cancellation, success, failure, expiry, deletion
retry, prompt-like image content, and log/analytics canaries; verify that no
unapproved dispatch, purpose crossover, content leakage, or retention beyond the
hard deadline occurs.

**Acceptance Scenarios**:

1. **Given** a configured processing path sends image or OCR content to an
   external provider, **When** the user has not granted the required explicit
   purpose- and provider-specific consent, **Then** no content is dispatched and
   an internal or manual path is offered when available.
2. **Given** search-image processing succeeds, fails, is cancelled, or expires,
   **When** its lifecycle ends, **Then** the source image and raw OCR text become
   inaccessible immediately and all server-managed copies are physically
   deleted no later than 15 minutes after admission.
3. **Given** an uploaded image or CV contains instructions addressed to the
   system or AI, **When** it is processed, **Then** those instructions remain
   inert document data and cannot trigger tools, network actions, policy
   changes, secret access, or unapproved provider use.
4. **Given** an operational or audit event is recorded, **When** authorized
   personnel inspect it, **Then** it identifies the purpose, safe outcome,
   versions, and timing without containing the source image, raw OCR text,
   generated private content, or secrets.

### Edge Cases

- A PDF contains an incorrect or invisible text layer that materially disagrees
  with visible page content, or a mixed page contains both useful native text
  and additional text inside an image; the page is treated as suspicious and
  its material conflict is shown for Candidate review.
- A PDF repeats headers, footers, backgrounds, or image text across pages and
  would otherwise duplicate segments.
- A DOCX contains floating images, repeated logos, portraits, decorative icons,
  headers or footers, unreferenced media, external relationships, macros,
  embedded objects, active content, or unsupported image formats; headers,
  footers, footnotes, comments, and other non-body regions remain outside this
  release's OCR eligibility boundary.
- A PNG/JPEG is zero bytes, exceeds 5,000,000 bytes, exceeds 20 decoded
  megapixels, has misleading extension/type/signature data, is truncated,
  animated, polyglot, malicious, or expands disproportionately during decoding.
- An image is rotated, mirrored, blurred, low contrast, photographed at an
  angle, multi-column, unusually spaced, or contains Vietnamese diacritics mixed
  with English technical terms.
- The OCR result is empty, exceeds bounded output, contains invalid Unicode,
  repeats content, or is dominated by low-confidence text.
- A DOCX contains more than 20 eligible text-bearing images or its eligible
  images exceed 100 decoded megapixels in aggregate.
- AI returns unknown filters, invalid enum values, excessive keywords,
  contradictory ranges, a job identifier, ranking instructions, private entity
  criteria, low-confidence values, or broader inferences unsupported by the
  recognized text.
- A user edits or clears generated filters while interpretation is pending,
  starts concurrent image queries, navigates away, loses connectivity, or
  retries after an uncertain completion; any in-memory OCR fallback text is
  discarded on navigation, reload, cancellation, or a newer query.
- A visitor changes browser state or shares a network with other visitors, or an
  authenticated user signs in from multiple devices while approaching an image-
  query limit; the applicable server-enforced limit remains authoritative.
- A job becomes unavailable between search-intent creation and result display;
  pagination or a shared search URL is opened after availability changes.
- External consent is revoked after queueing but before dispatch, a configured
  provider changes, or one provider fails while another provider exists.
- Logical deletion succeeds but physical cleanup fails temporarily, or a late
  worker tries to write after the artifact retention deadline.

## Requirements _(mandatory)_

### Functional Requirements

#### Scope and Purpose Boundaries

- **FR-001**: The system MUST expose OCR only through the approved Candidate CV
  document purpose and image-assisted public job-search purpose; data and
  results from one purpose MUST NOT enter the other purpose.
- **FR-002**: Candidate CV admission MUST continue to accept only PDF and DOCX
  files greater than zero bytes and no larger than exactly 5,000,000 bytes, and
  MUST reject standalone image files as CV uploads.
- **FR-003**: CV OCR MUST inherit every Feature 004 ownership, authorization,
  upload, quota, malware, structural-safety, consent, retry, retention,
  deletion, draft-review, conflict, and confirmation requirement unless this
  specification defines a stricter additive requirement.
- **FR-004**: Image-assisted search MUST accept exactly one standalone static
  PNG or JPEG per query, greater than zero bytes, no larger than exactly
  5,000,000 bytes, and no larger than 20 decoded megapixels.
- **FR-005**: Search-image acceptance MUST require agreement among normalized
  extension, declared media type, content signature, actual length, and safe
  decoded structure; no single indicator is sufficient.
- **FR-006**: Before a trustworthy clean malware result, search-image handling
  MUST be limited to bounded transport, length, type, and leading-signature
  checks. Format-aware decoding and OCR MUST run only after a clean result.
- **FR-007**: Unsupported formats, malformed images, polyglots, animated images,
  excessive dimensions, decompression bombs, active content, embedded objects,
  external resources, or indeterminate malware results MUST fail closed with a
  safe user-facing outcome.

#### Candidate CV OCR

- **FR-008**: CV OCR MUST run only for an authorized, unexpired Feature 004
  import whose persisted malware assessment is clean and whose document has
  passed the existing format-specific structural validation.
- **FR-009**: The system MUST attempt existing machine-readable text extraction
  first and MUST invoke OCR only when a PDF page or DOCX content unit has
  insufficient native text or when a documented, versioned eligibility policy
  classifies its native text as suspicious.
- **FR-010**: Each supported PDF page with insufficient or suspicious native
  text MUST either produce ordered OCR segments with page provenance or an
  explicit page-level low-confidence/failure outcome. A material native/OCR
  disagreement MUST be flagged for Candidate review and MUST NOT be silently
  resolved as verified Candidate fact; no eligible page may be omitted. Each CV
  OCR unit MUST have a 20-second wall-clock deadline and at most two units MAY
  run concurrently. All units, queueing, and retries for one hybrid extraction
  MUST share one immutable 180-second deadline beginning when its OCR-required
  manifest is first claimed; retries MUST NOT reset or extend that deadline.
- **FR-011**: DOCX OCR MUST process only supported PNG/JPEG images referenced as
  part of the main document body and MUST place their recognized text
  according to main-document traversal relative to native paragraphs. If an
  exact anchor cannot be established, the text MUST appear as a separately
  labeled segment at the nearest deterministic location rather than being
  silently reordered.
- **FR-012**: DOCX OCR MUST NOT process headers, footers, footnotes, comments,
  other non-body regions, unreferenced media, external resources, macros, active
  content, embedded objects, portraits as biometric inputs, or unsupported
  visual formats. Existing unsafe-document rejection remains authoritative.
- **FR-013**: One DOCX import MUST process no more than 20 eligible images and no
  more than 100 decoded megapixels across those images. Exceeding either limit
  MUST produce an actionable bounded failure without partial draft acceptance.
- **FR-014**: Native and OCR segments MUST be normalized into one ordered,
  bounded extraction result under a documented, versioned deduplication policy.
  The policy MUST prevent repeated copies of the same source text without
  removing distinct visible text merely because it resembles native text.
- **FR-015**: Every OCR-derived CV segment MUST identify its source document,
  page or document-image location, source type, recognition confidence,
  processing-policy version, and OCR engine/model version.
- **FR-016**: Low-confidence, incomplete, or contradictory OCR content MUST be
  identified under a documented, versioned confidence policy, visibly marked in
  the review experience, and MUST NOT be represented as verified Candidate fact.
- **FR-017**: The combined extraction MUST enter only the existing bounded CV
  parser and draft workflow. OCR, its provider, and the parser MUST NOT directly
  create, replace, or delete Candidate Profile data.
- **FR-018**: Candidate Profile changes based on OCR content MUST require the
  same editable review, selection, exact-revision validation, idempotent
  confirmation, and atomic persistence required by Feature 004.
- **FR-019**: When CV OCR is unavailable, times out, fails validation, produces
  no useful text, or remains below the approved quality threshold, the system
  MUST provide the existing permitted retry, replacement-upload, and manual
  Profile-entry recovery paths.
- **FR-020**: Existing text-based PDF/DOCX inputs MUST retain their native
  extraction behavior and MUST NOT become dependent on OCR availability.
- **FR-021**: OCR-derived CV source, text, draft content, and provenance MUST use
  the same access controls and retention/deletion deadlines as the corresponding
  Feature 004 temporary artifacts.
- **FR-056**: After a Candidate confirms a Feature 004 CV import, the status and
  immutable confirmation receipt MUST remain readable through the persisted upload
  identifier, including for `EXTERNAL_OPENAI` imports. The status projection MUST
  NOT issue a new external-consent challenge when the temporary import content is
  already inaccessible (`contentInaccessibleAt` is set), and the editable draft
  route MUST remain unavailable after confirmation.

#### Image-Assisted Job Search

- **FR-022**: The global search interface MUST offer an image mode for visitors
  and authenticated users without removing or disabling ordinary text search.
- **FR-023**: Image-search processing MUST be asynchronous, display meaningful
  progress and cancellation controls, and preserve the user's current manual
  query and filters until a current validated image result is ready.
- **FR-024**: A clean accepted search image MUST be recognized into bounded text
  before AI interpretation, and OCR text MUST be treated only as untrusted user
  search input. A search OCR request MUST have a six-second wall-clock deadline;
  retries and lease recovery MUST consume the remaining time of the same query
  processing deadline and MUST NOT reset retention or processing deadlines.
- **FR-025**: AI interpretation MUST return only a versioned, schema-validated
  search intent composed of Feature 003-supported keywords and filters,
  including location, employment type, experience level, working arrangement,
  disclosed salary range, skills/tags, and posting date where supported by the
  recognized content.
- **FR-026**: AI interpretation MUST NOT return or influence job identifiers,
  hidden job attributes, direct inclusion/exclusion lists, recommendation
  scores, result ranking, application actions, Candidate Profile data, or any
  private candidate, application, recruiter, or company criteria.
- **FR-027**: Each generated keyword or filter MUST retain bounded provenance to
  the recognized text, its interpretation confidence, and whether it is
  explicit, meaning-preserving normalized, or a broader inference. Unsupported,
  invalid, contradictory, excessive, or unevidenced criteria MUST NOT affect the
  search.
- **FR-028**: Only high-confidence explicit or meaning-preserving normalized
  criteria MAY be applied automatically, and only when they are simultaneously
  displayed as accessible controls that the user can edit, remove, clear, and
  reverse without uploading the image again. Broader or low-confidence
  inferences MUST remain visibly labeled and unselected until the user chooses
  them.
- **FR-029**: The existing deterministic Feature 003 search MUST remain the sole
  authority for matching, filtering, sorting, tie-breaking, pagination, and
  availability enforcement after a validated search intent exists.
- **FR-030**: Image-assisted search MUST return only Administrator-approved
  postings that are active, within their publication and application windows,
  and otherwise visible to the actor under Feature 003.
- **FR-031**: Image-derived search criteria MUST preserve Feature 003's
  case-insensitive and Vietnamese-diacritic-insensitive matching, input bounds,
  validation, stable sorting, pagination, and safe shareable criteria behavior.
- **FR-032**: A shareable search state MUST contain only validated visible search
  criteria and MUST NOT contain the source image, raw OCR text, private
  provenance, provider payload, or internal processing identifier.
- **FR-033**: If AI interpretation is unavailable or invalid after successful
  OCR, the user MUST be able to review or edit the bounded recognized text in
  the current in-memory browser interaction and submit it through ordinary
  deterministic text search. The text MUST NOT be written to persistent browser
  storage and MUST be discarded on reload, navigation, cancellation, or a newer
  query.
- **FR-034**: If OCR is unavailable or unsuccessful, the user MUST receive a
  clear retry/manual-search outcome while ordinary text search remains usable.
- **FR-035**: A stale, cancelled, expired, or superseded image-search result MUST
  NOT modify the current query, visible filters, URL, or result set.

#### Security, Privacy, Consent, and Retention

- **FR-036**: Search-image source files, raw OCR text, and unvalidated provider
  output MUST remain purpose-limited processing data and MUST NOT become CV,
  Candidate Profile, application, saved-job, analytics, training, or persistent
  search-index data.
- **FR-037**: Server-managed search-image source files and raw OCR text MUST
  become inaccessible immediately after success, terminal failure,
  cancellation, or expiry, and all server-managed copies MUST be physically
  deleted no later than 15 minutes after admission. A bounded one-time OCR-text
  fallback MAY exist only in the current in-memory browser interaction under
  FR-033 and MUST NOT extend server-side retention. Image admission MUST fail
  closed until hard-deadline transitions, cleanup, and reconciliation have
  completed an initial readiness check; a feature flag or deployment note alone
  MUST NOT bypass this structural prerequisite.
- **FR-038**: Search-image metadata and orientation MAY be used only to normalize
  recognition; unrelated embedded metadata, including location metadata, MUST
  be removed before OCR or external dispatch and MUST NOT be retained.
- **FR-039**: External OCR or AI processing MUST require a currently valid,
  explicit, unselected consent control identifying the provider, purpose,
  privacy-notice version, consent-text version, and applicable retention
  disclosure before any content is dispatched.
- **FR-040**: Refusal or revocation of external-processing consent MUST prevent
  future dispatches without disabling an available internal path, ordinary text
  search, replacement CV upload, or manual Profile editing.
- **FR-041**: The system MUST NOT silently send content to a second provider
  after failure. A provider, purpose, policy, or material processing change MUST
  require the approval and consent defined for that destination.
- **FR-042**: OCR and AI MUST treat instructions, links, hidden text, and prompt-
  like content inside a document or image as inert user data and MUST NOT invoke
  tools, access secrets, initiate network actions, alter policy, or broaden
  processing purpose because of that content.
- **FR-043**: The feature MUST NOT perform face recognition, identity matching,
  age/gender inference, emotion analysis, or other biometric or protected-
  attribute analysis on portraits or other images.
- **FR-044**: Source images, raw OCR text, CV content, generated private content,
  secrets, storage locators, prompts, and provider payloads MUST NOT appear in
  ordinary logs, traces, metrics, analytics, URLs, or audit descriptions.
- **FR-045**: Safe operational evidence MUST record purpose, actor class where
  appropriate, outcome, timing, applicable consent reference, provider/model,
  OCR and search-intent policy/schema versions, and deletion outcome without
  retaining prohibited content.
- **FR-046**: Resource limits, timeouts, cancellation, and isolation MUST apply
  independently to malware scanning, image decoding, OCR, AI interpretation,
  and cleanup. An indeterminate safety result MUST fail closed for that input
  without disabling unrelated CV-native extraction or manual text search.

#### Reliability, Accessibility, and Quality

- **FR-047**: OCR MUST support representative Vietnamese, English, and bilingual
  CV and job-poster content, preserving Vietnamese diacritics in recognized and
  displayed text.
- **FR-048**: The image-search interface, progress, filter controls, confidence
  and failure messages, consent, cancellation, and recovery actions MUST support
  keyboard operation, descriptive labels, visible focus, sufficient contrast,
  non-color cues, and responsive use at 320 CSS pixels.
- **FR-049**: P95 image-assisted search interpretation from accepted image to
  validated visible search intent MUST complete within 10 seconds under the
  documented representative test conditions, and processing MUST remain
  asynchronous.
- **FR-050**: After a validated search intent is available, P95 deterministic
  search and filtering MUST meet Feature 003's two-second target under its
  documented representative test conditions.
- **FR-051**: Candidate CV OCR MUST run asynchronously and MUST produce either a
  review-ready draft or an actionable bounded outcome within the immutable
  180-second hybrid-extraction deadline from FR-010 without blocking Candidate
  Profile editing. When less than 20 seconds remain, a unit receives only the
  remaining time; expiry stops new dispatch, rejects late output, and produces
  an actionable bounded outcome.
- **FR-052**: Duplicate delivery, retries, cancellation, worker recovery, and
  concurrent image queries MUST be idempotent or safely superseded so that one
  logical input cannot create conflicting active results or extend retention.
- **FR-053**: Every eligible PDF page and DOCX image MUST be accounted for as
  native, OCR-derived, non-text, low-confidence, unsupported, or failed; no
  content unit may disappear from operational outcome accounting.
- **FR-054**: Existing Feature 003 text-search behavior and Feature 004 native
  PDF/DOCX import behavior MUST pass regression verification unchanged when OCR
  and AI-assisted image search are disabled or unavailable.
- **FR-055**: A visitor MUST be limited to 3 admitted image-search queries per
  rolling hour under both source-IP and browser limits, and an authenticated
  user MUST be limited to 10 per rolling hour per account. Exceeding any
  applicable limit MUST prevent expensive processing, MUST NOT extend content
  retention, MUST expose an accessible retry time, and MUST NOT limit ordinary
  text search.

### Required Evaluation Corpus Minimum

The committed synthetic/licensed evaluation corpus MUST contain at least 180
unique fixtures and 18,000 ground-truth words. A fixture MAY satisfy multiple
stratification axes, but the 180-fixture overall minimum prevents overlap from
reducing the corpus to a trivial sample. The following floors are mandatory:

| Required cohort                   | Minimum unique fixtures | Minimum ground-truth words | Additional distribution rule                                                                                                                           |
| --------------------------------- | ----------------------: | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vietnamese text                   |                      40 |                      4,000 | CV and poster examples MUST both be represented.                                                                                                       |
| English text                      |                      40 |                      4,000 | CV and poster examples MUST both be represented.                                                                                                       |
| Bilingual Vietnamese/English text |                      40 |                      4,000 | Mixed-language lines and technical terms MUST be represented.                                                                                          |
| Layout variation                  |                      40 |                      4,000 | At least 10 each for CV/resume pages, job posters, structured forms/tables, and multi-column screenshots.                                              |
| Quality variation                 |                      40 |                      4,000 | At least 10 each for low resolution, skew/perspective, noisy/compressed, and low-contrast/blurred inputs.                                              |
| Security and edge cases           |                      30 |                      1,000 | At least 5 each for malicious/signature, malformed/truncated, polyglot/animated, decompression-limit, prompt-like, and excluded-document-region cases. |

The purpose cohorts MUST include at least 60 CV fixtures with 6,000 words and 60
job-poster fixtures with 6,000 words. The poster cohort MUST include at least 20
Vietnamese, 20 English, and 20 bilingual fixtures and MUST exercise every
supported search-intent field with positive, negative, and confidence-boundary
labels. Structurally rejected zero-text security fixtures count toward their
fixture floor but not a word-accuracy denominator; the text-bearing security
subset MUST still provide the required 1,000 words, and rejection expectations
MUST pass in 100% of those cases.

### Key Entities

- **OCR Processing Purpose**: The approved purpose profile that separates CV
  document extraction from ephemeral job-search interpretation, including
  permitted input, output, retention, consent, and fallback rules.
- **OCR Processing Attempt**: One bounded, traceable recognition attempt with
  purpose, lifecycle state, safe outcome, timing, engine/model and policy
  versions, and deletion state, but no ordinary-log copy of source content.
- **OCR Text Segment**: A bounded recognized text unit with order, source type,
  page or document-image location, confidence, and processing provenance.
- **CV OCR Extraction**: The additive native/OCR extraction result associated
  with an existing Feature 004 import and extraction attempt; it remains
  temporary source material for the existing parser and draft.
- **Search Image Query**: One ephemeral PNG/JPEG input and processing lifecycle
  for the public job-search purpose; its source image and raw OCR text are not
  persistent search data, and any one-time OCR-text fallback exists only in the
  current in-memory browser interaction.
- **Search Intent**: A versioned set of validated visible keywords and Feature
  003-supported filters, with bounded provenance, confidence,
  explicit/normalized/inferred classification, selection state, and current or
  superseded lifecycle state; it contains no job identifiers or ranking
  decisions.
- **Image-Search Admission Limit**: A rolling-hour, content-free usage boundary
  associated with a visitor's source IP and browser or an authenticated account;
  it controls image processing without limiting ordinary text search.
- **Processing Consent**: Versioned evidence of approval for a named external
  provider and purpose without retaining the source image or raw OCR content.

### Scope Boundaries

**In scope**:

- OCR fallback for insufficient visual text inside accepted Candidate PDF/DOCX
  files after the existing clean malware and structural-safety gates.
- Ordered native/OCR CV extraction, provenance, confidence, existing parser and
  review integration, recovery, consent, retention, and regression protection.
- One ephemeral PNG/JPEG query in the global search interface for public active
  job discovery.
- OCR-to-validated-search-intent processing, visible reversible filters, and
  deterministic Feature 003 job retrieval.

**Out of scope**:

- Standalone PNG/JPEG Candidate CV uploads or any new CV upload format.
- SVG, GIF, HEIC, TIFF, animated images, office formats other than DOCX, or CV
  files larger than the existing constitutional limit.
- AI-generated job identifiers, semantic result ranking, autonomous job
  recommendations, application submission, Candidate scoring, or hiring action.
- Resume rewriting, qualification enhancement, face recognition, biometric
  analysis, protected-attribute inference, or image generation.
- Persistent search-image libraries, indexing raw OCR text, model training from
  user content, or global search over private candidate/application/company
  records.
- Changes to Feature 003 deterministic job-search semantics or Feature 004
  transactional Profile-confirmation rules.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In 100% of regression runs, supported text-based PDF/DOCX imports
  and ordinary text-search queries produce the same authoritative outcomes when
  OCR/AI is disabled as they did before Feature 005.
- **SC-002**: Across at least the required 60-CV/6,000-word purpose cohort, at
  least 90% of representative clean supported image-only or mixed-content CV
  fixtures across Vietnamese, English, and bilingual groups
  produce a review-ready draft or actionable terminal outcome within 120
  seconds, and 100% do so within three minutes under documented representative
  conditions. Every non-draft outcome offers low-confidence review where safe,
  replacement, retry, or manual entry rather than a silently incomplete success.
  Every deliberate hidden, misleading, or materially conflicting PDF text-layer
  fixture is classified as suspicious and shown for Candidate review, and no
  DOCX image from an excluded non-body region influences the resulting draft.
- **SC-003**: Across the approved clear-quality OCR corpus, at least 95% of words
  are transcribed correctly overall and no Vietnamese, English, or bilingual
  group falls below 90% word accuracy. The result is valid only when the corpus
  satisfies the 180-fixture/18,000-word minimum and every language, layout,
  quality, purpose, and security cohort floor defined above; zero-text rejected
  fixtures are reported separately and cannot inflate word accuracy.
- **SC-004**: In 100% of CV acceptance tests, no Candidate Profile field or child
  record changes before an explicit valid Candidate confirmation, and every
  confirmed change remains subject to Feature 004 atomicity and conflict rules.
- **SC-005**: At least 90% of representative job-poster images produce the
  human-labeled supported keyword/filter intent without any unsupported field,
  job identifier, or AI-generated ranking instruction affecting results. In
  100% of confidence-boundary tests, broader or low-confidence inferences remain
  labeled and unselected until explicitly chosen. This measurement MUST use at
  least 60 poster fixtures and 6,000 words, including at least 20 Vietnamese, 20
  English, and 20 bilingual posters, with all supported intent fields and the
  required layout, quality, and security strata represented.
- **SC-006**: Across at least 100 warmed accepted image-search samples at
  concurrency four and the documented resource profile, at least 95% show a
  validated editable intent, manual-text fallback, or actionable terminal
  outcome within 10 seconds; at least 95% of the resulting deterministic
  searches show their result state within a further two seconds.
- **SC-007**: At least 90% of representative participants can search from an
  image, identify which filters were generated, edit or remove one filter, and
  understand the resulting job list on their first attempt without assistance
  at desktop and 320-pixel mobile widths.
- **SC-008**: In 100% of authorization and availability tests, image-assisted
  search exposes zero pending, rejected, removed, future, unavailable, or
  unauthorized job/private candidate/application/company records.
- **SC-009**: In 100% of controlled-clock retention tests, a completed, failed,
  cancelled, or expired search image and server-managed raw OCR text become
  inaccessible immediately and all server-managed copies are physically absent
  no later than 15 minutes after admission. Browser fallback tests retain text
  only in the current in-memory interaction and discard it on reload, navigation,
  cancellation, or a newer query.
- **SC-010**: In 100% of provider-failure, invalid-output, cancellation,
  duplicate-delivery, stale-result, and consent-refusal tests, native CV
  extraction and ordinary text search remain available, no stale result changes
  current user state, and no content is sent to an unapproved provider.
- **SC-011**: Security and privacy canary tests find zero source images, raw OCR
  text, CV content, generated private content, secrets, storage locators,
  prompts, or provider payloads in ordinary logs, traces, metrics, analytics,
  URLs, or audit descriptions.
- **SC-012**: In 100% of boundary, concurrent, multi-device, and controlled-clock
  tests, the fourth visitor or eleventh authenticated image query within the
  applicable rolling hour is rejected before expensive processing, reports an
  accurate retry time, and leaves ordinary text search available.

## Assumptions

- Features 003 and 004 are completed authoritative baselines. Feature 005 is an
  additive extension and does not rewrite their historical specifications or
  weaken their existing behavior.
- The image control may appear in a site-wide search surface, but Feature 005
  image mode searches only public job postings; any future private or multi-
  entity global search requires a separately approved specification.
- One image per search query is sufficient for the first release. Multi-image,
  video, camera-stream, and multi-page image formats are deferred.
- The first approved visual language set is Vietnamese, English, and bilingual
  Vietnamese/English content.
- Search-image inputs are expected to be job posters, screenshots, or
  photographs of job information. They are never treated as a Candidate CV even
  when they visually resemble one.
- A 15-minute hard server-side retention deadline is sufficient for bounded
  asynchronous search processing and retry-safe cleanup without creating a
  persistent content store.
- OCR text exposed after AI failure is a one-time current-interaction fallback;
  it is not persisted in browser storage and cannot be resumed after reload or
  navigation.
- Provider and engine selection, processing topology, exact eligibility and
  confidence thresholds, and deployment sizing will be decided during planning
  behind replaceable boundaries; the user-facing requirements in this
  specification remain provider-independent.
- Existing session, public-job visibility, CV consent, Candidate Profile,
  deterministic search, and temporary CV retention policies remain in force.
