# Feature Specification: CV Upload, Parse, and Review

**Feature Branch**: `004-cv-upload-parse-review`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Allow an authenticated candidate to upload a PDF or DOCX CV, validate and scan it safely, parse it asynchronously into a separate editable draft, review and selectively confirm the proposed information, and update Candidate Profile atomically without exposing sensitive CV data or coupling the workflow to one parser, scanner, storage provider, or AI provider."

## Clarifications

### Session 2026-08-01

- An uploaded CV is an import source for this feature, not a permanent candidate
  document. A separate retained document library for job applications is outside
  Feature 004.
- The MVP uses a privately operated ClamAV service through `clamd`, with malware
  signatures maintained by `freshclam`. Local development uses Docker Compose;
  production keeps the service on a private network. A public sample-sharing
  scanning service MUST NOT receive candidate CV files.
- Q: Which malware scanner does the MVP use? → A: Use private ClamAV through
  `clamd`, update signatures with `freshclam`, run it through Docker Compose
  locally and a private-network service in production, and keep it behind a
  replaceable scanner interface.
- The upload content digest is used for integrity verification and request
  idempotency only. It MUST NOT cause automatic cross-account deduplication or
  silent reuse of an older draft.
- Unconfirmed draft content and its provenance have separate bounded serialized
  sizes. Oversized parser output fails safely and is never silently truncated.
- Draft edits use optimistic concurrency. A stale edit is rejected rather than
  applied under last-write-wins.
- Exhausted parser retries produce a terminal, user-visible failure with an
  immediate manual-entry and user-retry path; the user never waits for an
  operator to re-drive a dead-letter item.
- Q: Where does manual recovery lead after parsing fails? → A: Open the
  existing Candidate Profile editor from Feature 002. The failed CV import
  remains available as status/history, and Feature 004 does not create an empty
  CV draft for manual entry.
- Q: At what granularity can a candidate select proposed draft changes? → A:
  Select scalar profile information per field; select experience, education,
  and social-link collections per entry; and select skills individually. A
  structured entry can be edited before it is selected, but its nested
  properties are not independently selectable.
- Q: What happens to the draft and CV-derived content after confirmation? → A:
  Lock the draft immediately and expose only a read-only receipt without source
  snippets or skipped values. Delete the source file, extracted text, complete
  draft payload, and provenance within seven days; retain only minimum
  non-content confirmation and audit metadata.
- Q: What parsing work does one external-processing consent grant cover? → A:
  It covers the initial job and permitted retries only for the exact upload,
  provider, purpose, privacy-notice version, and consent-text version until
  revocation or upload expiry. Any change to those bindings requires a new
  explicit grant.
- A separate administrator dead-letter interface is outside MVP scope. Failed
  parsing attempts remain durable and observable without requiring direct
  database mutation as a supported workflow.
- External semantic processing requires durable, versioned consent evidence
  linked to the exact upload, purpose, and provider before any CV content is
  dispatched.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Upload a CV and Receive a Safe Draft (Priority: P1)

An authenticated candidate uploads a supported CV and can leave the page while
the system validates, scans, and parses it. The candidate sees understandable
progress and receives a structured draft only after the file is proven eligible
for processing.

**Why this priority**: A safe, non-blocking path from a candidate-owned document
to a reviewable draft is the foundation of the feature. No later review or
profile update is trustworthy without it.

**Independent Test**: Upload one valid text-based PDF or DOCX of at most 5 MiB
for an active candidate, observe each processing state, and verify that a draft
is produced without changing Candidate Profile.

**Acceptance Scenarios**:

1. **Given** an active authenticated candidate with available upload quota,
   **When** they upload a valid, clean, text-based PDF or DOCX of at most 5 MiB,
   **Then** the file is quarantined, validated, scanned, queued, parsed
   asynchronously, and presented as a separate reviewable draft without any
   Candidate Profile change.
2. **Given** an uploaded file whose extension, declared type, content signature,
   or internal structure does not consistently identify an allowed document,
   **When** validation completes, **Then** the upload is rejected before parsing
   and the candidate receives an actionable, non-sensitive explanation.
3. **Given** a file that is infected or cannot receive a trustworthy clean scan,
   **When** scanning completes or fails closed, **Then** no parser receives the
   file and the candidate can safely upload another document.
4. **Given** a supported upload is still being scanned or parsed, **When** the
   candidate leaves and later returns on the same or another device, **Then**
   they see the authoritative current state without having to repeat a completed
   stage.
5. **Given** the same upload request is retried with the same idempotency key and
   identical content, **When** the server accepts the retry, **Then** it returns
   the original upload outcome and does not create another file or job.

---

### User Story 2 - Review and Selectively Import CV Information (Priority: P1)

The candidate compares proposed CV information with their current professional
profile, corrects uncertain values, chooses what to add, replace, or skip, and
confirms only the selected changes.

**Why this priority**: Parser output is probabilistic and may be incomplete or
wrong. Human review is the required control that turns extraction into useful,
trusted profile data.

**Independent Test**: Seed a review-ready draft for a candidate, edit its fields,
choose different actions across profile sections, confirm it, and verify that
only selected valid changes are applied as one complete profile revision.

**Acceptance Scenarios**:

1. **Given** a review-ready draft, **When** the candidate opens it, **Then** they
   can compare current and proposed values, see uncertainty and source context,
   and choose add, replace, edit, or skip per scalar field, per experience,
   education, or social-link entry, and per individual skill; a structured entry
   can be edited before selection but is selected as one unit.
2. **Given** proposed experience, education, skill, or social-link data that
   resembles an existing profile entry, **When** the candidate reviews it,
   **Then** the possible duplicate is identified but never merged automatically.
3. **Given** the candidate edits draft values, **When** they save, **Then** the
   same validation and safe text rules used by Candidate Profile are applied and
   a visible saved revision is returned.
4. **Given** a valid reviewed draft and an unchanged source profile revision,
   **When** the candidate confirms selected changes, **Then** all selected
   profile changes, the new profile revision, the confirmed draft state, and the
   audit outcome succeed as one complete result.
5. **Given** any selected value is invalid or persistence fails, **When** confirm
   is attempted, **Then** no partial profile, child-record, confirmation, or
   audit outcome is committed and the editable draft remains available.
6. **Given** the same confirmation is submitted again with the same idempotency
   key, **When** the first confirmation has completed, **Then** the same completed
   result is returned without another profile revision or duplicate child entry.
7. **Given** a draft is confirmed successfully, **When** the candidate views the
   result, **Then** they receive a read-only non-content receipt, cannot edit or
   reconfirm the draft, cannot view source snippets or skipped values, and all
   CV-derived source, draft, and provenance content is physically deleted within
   seven days without deleting the confirmed Candidate Profile values.

---

### User Story 3 - Recover from Extraction or Provider Failure (Priority: P2)

The candidate receives a bounded result when scanning, document extraction, or
semantic parsing cannot complete. They can retry within defined limits, upload
a replacement, or continue with manual profile entry without waiting for an
operator.

**Why this priority**: External and document-processing failures are expected.
They must not trap the candidate, corrupt the profile, or disable unrelated
profile editing.

**Independent Test**: Force scanner unavailability, extraction failure,
oversized output, and parser timeout in separate runs and verify terminal safe
states, bounded retry behavior, and an immediate manual path in each case.

**Acceptance Scenarios**:

1. **Given** a parsing attempt exceeds its time limit, **When** all automatic
   attempts are exhausted, **Then** the job becomes visibly parse-failed within
   the overall deadline and the candidate can immediately retry or enter data
   manually.
2. **Given** a parser returns unknown fields, excessive entries, invalid values,
   or an oversized draft, **When** the result is validated, **Then** it is treated
   as untrusted invalid output, no draft is partially accepted, and a safe error
   is shown.
3. **Given** a PDF contains no usable text and OCR is not available in MVP,
   **When** extraction completes, **Then** the candidate is told that the scanned
   document cannot be parsed and can upload a text-based document or edit their
   profile manually.
4. **Given** one external provider fails, **When** no separately consented
   fallback is configured, **Then** the CV is not silently sent to another
   provider.
5. **Given** a terminal parse failure and an unexpired clean upload, **When** the
   candidate requests a permitted retry, **Then** a new traceable job is created
   while the failed attempt remains unchanged for audit and diagnostics.
6. **Given** a terminal parse failure or unsupported scanned document, **When**
   the candidate chooses manual entry, **Then** the existing Candidate Profile
   editor from Feature 002 opens, the failed import remains available as
   status/history, and no empty CV draft is created.

---

### User Story 4 - Edit a Draft Safely Across Tabs and Devices (Priority: P2)

The candidate can resume a saved draft on another device without one tab or
device silently overwriting edits saved by another.

**Why this priority**: CV review is a long-form workflow. Visible concurrency
control prevents loss of candidate-authored corrections and makes resume behavior
trustworthy.

**Independent Test**: Open one draft revision in two sessions, save different
edits from each, and verify that the first succeeds while the second receives a
stale result with the latest revision and retains its unsaved local values.

**Acceptance Scenarios**:

1. **Given** two tabs loaded the same draft revision, **When** the first tab saves
   and the second later submits its stale revision, **Then** the stale save is
   rejected, the latest saved revision is identified, and neither version is
   silently overwritten.
2. **Given** a tab has unsaved edits when a stale result is returned, **When** the
   interface presents the conflict, **Then** the unsaved values remain visible
   so the candidate can compare, copy, or deliberately reload.
3. **Given** the draft changes after a confirmation page is opened, **When** the
   stale confirmation is submitted, **Then** confirmation is rejected until the
   candidate reviews the latest draft.
4. **Given** Candidate Profile changes after the draft source revision was
   captured, **When** confirmation is attempted, **Then** no CV changes are
   applied until a fresh comparison is shown and the candidate confirms against
   the current profile.

---

### User Story 5 - Control External Processing and Data Retention (Priority: P3)

The candidate understands whether an external provider will process their CV,
gives explicit consent when required, can revoke future external processing,
and can delete an import that is no longer wanted.

**Why this priority**: A CV contains sensitive personal and professional data.
Purpose limitation, evidence of consent, deletion, and predictable retention are
required even though they do not change the extracted profile fields.

**Independent Test**: Attempt external parsing before consent, grant versioned
consent and parse, revoke it before retry, delete the upload, and verify that
dispatch, access, cancellation, and deletion follow the recorded choices.

**Acceptance Scenarios**:

1. **Given** an external parser is selected and consent is not recorded, **When**
   parsing would otherwise start, **Then** no CV content is dispatched and the
   candidate is shown the applicable notice with an unselected consent control.
2. **Given** the candidate grants consent for a named processing purpose and
   provider, **When** a job is queued, **Then** durable evidence of the notice
   version, consent-text version, provider, upload, purpose, and grant time is
   linked to that job and MAY be linked to permitted retries only while every
   binding remains unchanged and the grant remains valid.
3. **Given** consent is revoked before dispatch or a retry, **When** processing is
   evaluated, **Then** the pending external dispatch or new retry is blocked and
   the candidate is told that revocation cannot undo processing already
   completed by a provider.
4. **Given** an active upload or draft owned by the candidate, **When** they
   delete it, **Then** pending work is cancelled, access is immediately denied,
   and physical deletion is completed within the defined deletion window.
5. **Given** an upload or draft reaches its expiry time, **When** any user or job
   attempts to access it, **Then** access is denied immediately even if physical
   storage cleanup is still pending.

### Edge Cases

- A zero-byte file, file over 5 MiB, file with multiple misleading extensions,
  renamed executable, polyglot document, truncated document, or unsupported old
  binary word-processing document is uploaded.
- A PDF is password-protected, encrypted, contains embedded files or active
  content, exceeds 20 pages, or contains only scanned images.
- A DOCX archive attempts path traversal, expands beyond 25 MiB, contains more
  than 1,000 entries, external relationships, macros, embedded objects, or
  malformed XML.
- The upload connection is interrupted before finalization, or reported size
  differs from the received size.
- Two concurrent uploads attempt to consume the final available account quota.
- The same content is uploaded with a new idempotency key while an older draft
  exists or uses another parser/schema version.
- Malware signatures are unavailable or stale, the scanner times out, or the
  scanner reports an unsupported or indeterminate result.
- A file expires or is deleted while scanning, extracting, parsing, or retrying.
- The parser treats instructions embedded in a CV as commands, returns unknown
  fields, excessive arrays, unsafe links, invalid dates, or output that exceeds
  draft-size limits.
- Vietnamese diacritics, Unicode whitespace, ambiguous month/year dates, current
  employment, repeated skills, and values that become empty after safe text
  normalization are encountered.
- Two devices edit the same draft; a draft edit races with confirmation; two
  confirmations race; or Candidate Profile changes during review.
- The candidate session expires or the account becomes inactive during upload,
  review, retry, deletion, or confirmation.
- External consent is revoked after queueing but before dispatch, or a provider
  change is proposed after consent was granted.
- Storage deletion succeeds but metadata cleanup fails, metadata cleanup is
  retried after the object is already absent, or provider lifecycle cleanup
  removes an object before reconciliation.

## Requirements _(mandatory)_

### Functional Requirements

#### Access, Ownership, and Trust Boundaries

- **FR-001**: Only an authenticated user with an active account MUST be able to
  create, view, edit, retry, confirm, cancel, or delete their own CV import.
- **FR-002**: Ownership MUST be derived from the authoritative server-validated
  session on every operation. A browser-supplied user, profile, upload, job,
  draft, consent, or confirmation owner identifier MUST NOT grant access.
- **FR-003**: Every protected mutation MUST enforce the project's existing
  same-origin and request-forgery protections before accepting file data or
  state changes.
- **FR-004**: An unauthorized, foreign-owned, expired, deleted, or nonexistent
  import resource MUST disclose no CV content, filename, processing result, or
  existence beyond a safe access result.

#### Upload Validation and Quotas

- **FR-005**: The system MUST accept only PDF and DOCX files of greater than zero
  bytes and no more than 5 MiB. Client-side checks MAY provide early feedback
  but MUST NOT replace authoritative server-side enforcement.
- **FR-006**: Acceptance MUST require agreement among the normalized filename
  extension, declared media type, content signature, and successfully validated
  internal document structure; no single indicator is sufficient by itself.
- **FR-007**: Corrupt, truncated, encrypted, password-protected, macro-enabled,
  active-content, embedded-file, or structurally unsafe documents MUST be
  rejected before semantic parsing.
- **FR-008**: A PDF MUST contain no more than 20 pages. A DOCX MUST expand to no
  more than 25 MiB and no more than 1,000 archive entries, and MUST NOT use
  traversal paths or external content relationships.
- **FR-009**: The original filename MUST be treated as untrusted personal data,
  MUST NOT determine a storage path or public locator, and MUST be displayed only
  to its owner through safe text rendering.
- **FR-010**: One account MUST be limited to 5 upload attempts per rolling hour,
  10 non-deleted CV imports, 50 MiB of reserved plus retained CV storage, and one
  active parsing job at a time.
- **FR-011**: Quota MUST be reserved before an upload can consume storage and
  reconciled atomically so concurrent uploads cannot together exceed the account
  limit. Failed, abandoned, rejected, expired, and deleted uploads MUST release
  their reservation or retained usage idempotently.
- **FR-012**: An interrupted or incomplete upload MUST NOT create a parseable CV,
  draft, or parsing job and MUST be cleaned up within 24 hours.
- **FR-013**: A server-computed SHA-256 content digest MUST be used to verify file
  integrity across storage, scanning, and extraction boundaries and to bind an
  upload request to its idempotency key. It MUST NOT be exposed in ordinary
  logs or client responses.
- **FR-014**: Repeating an upload with the same idempotency key and the same
  content digest MUST return the existing accepted result. Reusing that key for
  different content MUST be rejected without replacing the original binding.
- **FR-015**: A new upload request for identical content MUST NOT silently reuse
  an older draft or parser result. Cross-account digest matching and externally
  observable global deduplication are prohibited.

#### Quarantine, Malware Scanning, and Private Storage

- **FR-016**: Every received file MUST remain quarantined and inaccessible to
  document extraction, semantic parsing, inline display, or ordinary download
  until validation and a trustworthy malware scan both succeed.
- **FR-017**: Malware scanning for the MVP MUST use a privately operated ClamAV
  service through `clamd`, with signatures updated by `freshclam`. Local
  development MUST provide it through Docker Compose, production MUST expose it
  only on a private network, and neither environment MAY contribute candidate
  files to a public or partner-shared sample corpus. Application code MUST access
  it through a replaceable malware-scanner interface.
- **FR-018**: Scan state MUST distinguish at least pending, scanning, clean,
  infected, and error outcomes. An error, timeout, unsupported result, stale
  signature state, or unavailable scanner MUST NOT be interpreted as clean.
- **FR-019**: Each scan assessment MUST retain the scanner identity, engine
  version, signature version or update evidence, safe result, start time, and
  completion time without retaining raw scanner output in ordinary logs.
- **FR-020**: Only a currently authorized, unexpired upload with a clean scan MAY
  proceed to extraction or parsing.
- **FR-021**: An infected file MUST never be parsed or made retrievable, MUST show
  the candidate a safe non-diagnostic rejection, and MUST be physically removed
  within 24 hours while retaining only minimal audit evidence.
- **FR-022**: An indeterminate scan MAY be retried at most three times within five
  minutes. If no trustworthy clean result is obtained, the upload MUST enter a
  visible scan-failed state and require an explicit candidate retry or replacement
  upload.
- **FR-023**: Stored CV content, extracted source text, and drafts MUST remain
  private to their owning account and approved processing workers. They MUST NOT
  receive stable public URLs or be served as executable content.
- **FR-024**: Sensitive CV artifacts MUST be protected in transit and at rest,
  and access to the original document MUST use a short-lived, owner-authorized
  retrieval path when retrieval is explicitly permitted.
- **FR-025**: Feature 004 review MUST use safe structured values and source
  context rather than embedding an untrusted original document inline.

#### Retention, Deletion, and Storage Reconciliation

- **FR-026**: A Feature 004 upload is an import source only. Confirming a draft
  MUST NOT silently convert it into a permanent CV library or application
  attachment.
- **FR-027**: Rejected, infected, or incomplete files MUST be removed within 24
  hours; an unconfirmed upload and draft MUST expire 30 days after upload; and a
  confirmed import's source file, extracted text, complete draft payload, and
  provenance MUST be physically removed no later than 7 days after confirmation.
  Confirmed Candidate Profile values are not temporary CV artifacts and MUST NOT
  be removed by this cleanup.
- **FR-028**: An expired, candidate-deleted, or confirmed temporary CV artifact
  MUST become inaccessible to ordinary candidate content retrieval immediately,
  regardless of whether physical deletion has completed. A confirmed import MAY
  expose only the non-content receipt defined by this specification.
- **FR-029**: Retention deadlines MUST be actively enforced by an owned cleanup
  process, with a separate storage-level maximum-retention safeguard and a
  reconciliation process for missing or orphaned artifacts. `expiresAt` alone
  does not satisfy this requirement.
- **FR-030**: Candidate deletion MUST cancel pending work, prevent new retries or
  confirmation, delete source and extracted content idempotently, release quota,
  and retain only the minimum non-content audit evidence required by policy.

#### Asynchronous Extraction and Parsing

- **FR-031**: Scanning, document extraction, and semantic parsing MUST run
  asynchronously after upload acceptance; the upload request and candidate
  interface MUST NOT remain blocked while waiting for a parsing result.
- **FR-032**: The candidate MUST be able to distinguish upload, validation,
  scanning, queued, parsing, review-ready, scan-failed, parse-failed, cancelled,
  expired, and confirmed states through persistent status feedback.
- **FR-033**: Processing work MUST be durable, idempotent, bounded by leases or
  equivalent recovery controls, and safe to resume after worker interruption
  without producing duplicate drafts.
- **FR-034**: Safe document extraction and semantic CV interpretation MUST be
  independently replaceable capabilities. A parser MUST receive only the
  minimum approved input and MUST NOT own profile persistence.
- **FR-035**: A parser result MUST be stored only as a separate draft. No parser,
  retry, fallback, or worker MAY directly update Candidate Profile.
- **FR-036**: Parsing MAY extract and structure candidate-provided information
  but MUST NOT rewrite or embellish qualifications, generate a resume, score or
  rank the candidate, recommend jobs, or make a recruitment decision.
- **FR-037**: Every parsing attempt MUST trace its parser/provider identity,
  parser version, instruction version where applicable, output schema version,
  input version, attempt number, timing, and safe terminal result.
- **FR-038**: Parser output MUST be treated as untrusted input and rejected as a
  whole if it contains unknown properties, invalid field types, unsafe content,
  disallowed links, or values outside the approved profile and draft contracts.
- **FR-039**: A parser MUST NOT produce more data than the Candidate Profile can
  accept: 50 unique skills, 50 experience entries, 50 education entries, and 10
  unique social links, with all existing per-field length and calendar rules.
- **FR-040**: The serialized structured draft payload MUST be no more than 256
  KiB and serialized provenance MUST be no more than 128 KiB. Extracted raw text
  MUST NOT be stored inside either bounded value.
- **FR-041**: Oversized parser output MUST NOT be truncated or partially stored.
  It MUST end the attempt with a safe `PARSER_OUTPUT_LIMIT_EXCEEDED` result and
  make manual entry or a permitted retry immediately available.
- **FR-042**: Each semantic parsing attempt MUST time out after 60 seconds, use at
  most three automatic attempts with bounded backoff, and reach a terminal
  result within three minutes of the first attempt under documented normal
  service conditions.
- **FR-043**: When all automatic parsing attempts fail, the job MUST enter a
  terminal parse-failed state, preserve a safe failure history, and immediately
  offer the candidate the existing Candidate Profile editor from Feature 002,
  replacement upload, or permitted retry. The manual path MUST NOT create an
  empty CV draft, and opening it MUST NOT discard the failed import's
  status/history.
- **FR-044**: A candidate MAY initiate at most two parsing retries for one clean,
  unexpired upload. Each retry MUST create a new traceable attempt while leaving
  prior terminal attempts immutable.
- **FR-045**: MVP MUST NOT automatically send CV content to a different external
  provider after failure. Any future cross-provider fallback requires prior
  consent that explicitly covers the destination provider.
- **FR-046**: MVP MUST NOT require an administrator dead-letter interface or
  direct database edits for candidate recovery. Terminal failures MUST remain
  observable for operations while candidate retry and manual entry remain the
  supported recovery paths.
- **FR-047**: A document with insufficient machine-readable text MUST produce a
  clear unsupported-scan result in MVP. OCR is deferred, and the candidate MUST
  be able to upload a text-based document or proceed manually.
- **FR-048**: Instructions, links, hidden text, or other content inside a CV MUST
  be treated only as candidate document data and MUST NOT cause tool execution,
  secret access, network actions, policy changes, or unapproved provider calls.

#### Draft Review and Concurrent Editing

- **FR-049**: A draft MUST preserve proposed structured values, its source
  upload, output schema version, source profile revision, current draft revision,
  and review state independently of Candidate Profile.
- **FR-050**: Proposed fields and entries SHOULD include confidence or an
  equivalent uncertainty indicator plus bounded source context such as page or
  section location. Missing provenance MUST be visibly identified rather than
  invented.
- **FR-051**: Review MUST show current and proposed values and let the candidate
  add, replace, edit, or skip scalar profile information per field; experience,
  education, and social-link collections per entry; and skills individually
  before confirmation. A structured entry MAY be edited before selection, but
  its nested properties MUST be selected and applied as one entry rather than
  independently.
- **FR-052**: Possible duplicate experiences, education entries, skills, and
  links MUST be identified using the approved normalization rules but MUST NOT
  be merged, removed, or replaced without the candidate's explicit choice.
- **FR-053**: Candidate edits to a draft MUST satisfy the same normalization,
  safe-text, length, date, URL, collection-limit, and required-value rules that
  apply to direct Candidate Profile entry.
- **FR-054**: Every successful draft save MUST atomically increment and return a
  draft revision.
- **FR-055**: Every draft save MUST name the revision on which it is based. A
  stale save MUST be rejected with the latest saved revision and MUST NOT apply
  under last-write-wins.
- **FR-056**: Confirmation MUST name the exact reviewed draft revision. A later
  draft change MUST invalidate a stale confirmation until the candidate reviews
  the latest version.
- **FR-057**: When a stale edit is rejected, the interface MUST preserve the
  submitting tab's unsaved values and offer a visible comparison or deliberate
  reload path; it MUST NOT silently replace either version.
- **FR-058**: A saved draft MUST remain resumable across navigation, sign-in
  sessions, supported devices, and transient network failure until it is
  confirmed, deleted, or expired. The interface MUST visibly distinguish saved,
  saving, unsaved, conflict, and failed states. Successful confirmation MUST
  immediately make the draft immutable and unavailable for editing or another
  confirmation.
- **FR-059**: CV content, extracted text, draft values, consent evidence, and
  processing tokens MUST NOT be copied into localStorage, sessionStorage, or
  another persistent browser-side store.
- **FR-060**: An unconfirmed draft MUST expire with its import no later than 30
  days after upload and MUST not be confirmable after expiry.

#### Transactional Profile Confirmation

- **FR-061**: Confirmation MUST apply only the candidate-selected draft changes;
  skipped values and unselected possible duplicates MUST leave the current
  profile unchanged.
- **FR-062**: Before confirmation, the system MUST revalidate the active account,
  ownership, clean unexpired upload, review-ready draft, exact draft revision,
  applicable consent, and current Candidate Profile state.
- **FR-063**: If Candidate Profile changed after the draft's source revision,
  Feature 004 MUST NOT apply the bulk import under the Profile feature's ordinary
  last-write-wins behavior. It MUST show a fresh comparison against the current
  profile and require a new explicit confirmation.
- **FR-064**: A valid confirmation MUST apply selected profile and child-record
  changes, increment the Candidate Profile revision once, mark the exact draft
  confirmed and locked, record the confirmation binding and non-content receipt,
  and append the required audit result as one atomic outcome. The receipt MUST
  NOT contain source snippets, skipped values, or a copy of selected field
  values.
- **FR-065**: Confirmation MUST preserve stable owned child identifiers where an
  existing entry is deliberately updated and MUST validate that every selected
  owned identifier belongs to the confirming candidate.
- **FR-066**: Confirmation MUST require an idempotency key bound to the candidate,
  draft revision, source profile revision, and selected change set. A retry of
  the same binding MUST return the original result; rebinding the key MUST fail.
- **FR-067**: Any validation, authorization, concurrency, or persistence failure
  MUST roll back the complete confirmation and leave the draft available when it
  is still valid and unexpired.
- **FR-068**: Confirmed free text and links MUST remain inert when displayed and
  MUST never create executable markup, embedded credentials, or unsafe schemes.

#### External Processing Consent and Privacy

- **FR-069**: Before any CV content is sent to an external semantic-processing
  provider, the candidate MUST receive a clear purpose/provider notice and take
  an explicit action through a control that is unselected by default.
- **FR-070**: Consent evidence MUST durably identify the candidate, upload,
  processing purpose, provider, privacy-notice version, consent-text version,
  grant time, and any revocation time. A timestamp without those bindings is
  insufficient.
- **FR-071**: Every external parsing job MUST reference valid consent evidence
  before dispatch. One grant MAY cover the initial job and permitted retries
  only for its exact upload, provider, purpose, privacy-notice version, and
  consent-text version until revocation or upload expiry. A private internal
  parser does not require external-provider consent but remains subject to the
  displayed CV-processing privacy notice.
- **FR-072**: Revocation MUST block an undispatched external job and all later
  retries under that consent. The interface MUST explain that revocation cannot
  reverse provider processing that was already completed.
- **FR-073**: A different upload or a change to the destination provider,
  processing purpose, privacy-notice version, or consent-text version MUST
  require a new explicit grant; existing consent MUST NOT be broadened or
  migrated silently.
- **FR-074**: External processing MUST send only the minimum document content and
  context necessary for extraction and MUST NOT send browser sessions, account
  credentials, internal storage locators, unrelated profile fields, or hidden
  application secrets.

#### Audit, Feedback, and Accessibility

- **FR-075**: Ordinary logs, analytics, errors, and traces MUST exclude original
  filenames, CV bytes or text, extracted text, draft values, source snippets,
  contact details, content digests, storage locators, consent text, prompts,
  provider responses, tokens, sessions, and raw provider/scanner errors.
- **FR-076**: Allowlisted audit outcomes MUST cover upload acceptance/rejection,
  malware-scan result, parsing completion/failure/retry, draft confirmation,
  consent grant/revocation, expiry, candidate deletion, and retention deletion
  without storing CV content or unnecessary personal data.
- **FR-077**: User-visible and operational errors MUST use stable safe codes and
  actionable messages without exposing scanner signatures, provider payloads,
  storage paths, parser instructions, or database details.
- **FR-078**: The interface MUST provide persistent, keyboard-accessible upload,
  progress, review, conflict, success, failure, retry, manual-entry, cancellation,
  and deletion controls at desktop and 320-pixel mobile widths.
- **FR-079**: Processing and save status changes MUST be announced to assistive
  technology without unexpectedly moving focus. Error summaries MUST identify
  affected fields in text, and color MUST NOT be the only status indicator.
- **FR-080**: The candidate MUST be able to navigate away from long-running work
  and return without losing completed server-side progress or saved draft edits.

### Key Entities _(include if feature involves data)_

- **CV Upload**: A candidate-owned import source with its protected original
  name, private storage reference, actual and declared type evidence, byte size,
  SHA-256 integrity digest, quota usage, upload state, timestamps, and expiry.
  Its digest supports integrity and request idempotency only.
- **Malware Scan Assessment**: The durable, safe assessment of one upload,
  including pending/scanning/clean/infected/error state, scanner and signature
  version evidence, attempt timing, and a non-sensitive result code.
- **CV Parse Job**: One immutable processing attempt for a clean upload,
  including parser/provider and version evidence, consent reference when needed,
  attempt number, bounded timing, status, and safe failure code. A retry is a new
  related job rather than mutation of a terminal attempt.
- **CV Draft**: Candidate-editable proposed profile data, bounded provenance and
  uncertainty evidence, output schema version, source profile revision, draft
  revision, state, and expiry. It is not Candidate Profile and cannot affect it
  until confirmation. Confirmation locks it immediately, after which its payload
  and provenance are deleted within seven days.
- **CV Processing Consent**: Append-only evidence that a candidate agreed to a
  specified upload, external processing purpose, and provider under identified
  notice and consent-text versions, including grant and optional revocation
  times. It may be referenced by multiple permitted jobs only while those exact
  bindings remain valid.
- **CV Import Confirmation**: The durable idempotent binding among a candidate,
  exact draft revision, source/current profile revision, a non-content selection
  manifest, final profile revision, and safe receipt. It does not retain field
  values, source snippets, or skipped draft content.
- **CV Storage Quota Reservation**: Account-scoped reserved and retained byte
  usage that serializes concurrent upload admission and is released when an
  artifact no longer consumes storage.
- **Candidate Profile**: The existing authoritative structured profile aggregate
  updated only by a candidate-confirmed, validated, atomic import.

### Verification Requirements

- Contract tests MUST prove strict upload metadata, draft, consent, retry,
  conflict, confirmation, and safe-error behavior, including unknown-property
  rejection and no client-supplied ownership authority.
- Authorization tests MUST use at least two accounts and cover forged upload,
  job, draft, consent, confirmation, and profile identifiers; inactive and
  expired sessions; and cross-account digest equality without information
  disclosure.
- Malicious-file tests MUST cover renamed files, MIME/signature mismatch,
  polyglots, EICAR, corrupt and encrypted PDFs, active/embedded content,
  image-only PDFs, malformed DOCX, archive traversal, excessive expansion,
  excessive entry count, external relationships, and interrupted upload.
- Integration tests MUST use the selected private scanner and private storage
  boundary and prove fail-closed scanning, signature freshness behavior,
  quarantine isolation, digest verification, idempotent upload, quota races,
  cleanup retries, and storage/metadata reconciliation.
- Parsing tests MUST cover worker interruption, duplicate delivery, lease expiry,
  timeout, retry backoff, terminal failure, user retry limits, provider change,
  invalid/oversized output, prompt-injection content, and no direct profile
  writes.
- Concurrency tests MUST cover two draft writers, draft-save versus confirm,
  profile-save versus confirm, duplicate confirmations, deletion versus every
  processing stage, and exact one-revision profile outcomes.
- Privacy tests MUST prove that no CV content, filename, contact detail, digest,
  storage locator, consent text, prompt, token, session, raw scanner result, or
  provider response appears in ordinary logs, errors, analytics, or traces.
- Retention tests MUST use a controlled clock and prove immediate logical expiry,
  required physical-deletion windows, idempotent cleanup, quota release, and
  orphan reconciliation.
- Component and accessibility tests MUST cover keyboard upload/review, persistent
  and announced progress, descriptive error summaries, unsaved/conflict states,
  reduced motion, sufficient contrast, and no horizontal overflow at 320 pixels.
- End-to-end tests MUST cover the complete clean upload-to-confirm journey,
  infected rejection, scan failure, parse failure/manual recovery, consent grant
  and revocation, concurrent review, stale profile comparison, expiry, and
  candidate deletion with real authenticated sessions.

### Scope Boundaries

**In scope**:

- Candidate self-service PDF/DOCX upload, strict validation, quarantine,
  privately operated malware scanning, private temporary storage, asynchronous
  extraction/parsing, editable draft review, selective import, conflict-safe
  transactional confirmation, external-processing consent, deletion, retention,
  audit, accessibility, and bounded retry/manual recovery.

**Out of scope**:

- A permanent candidate document library or use of the uploaded source as a job
  application attachment.
- Recruiter, company member, administrator, or public access to candidate CV
  files or drafts through normal product interfaces.
- OCR for image-only documents in MVP.
- Resume rewriting, grammar enhancement, content invention, candidate scoring,
  ranking, job recommendations, gap analysis, or automated recruitment actions.
- Automatic fallback among external semantic-processing providers.
- A user-facing administrator dead-letter queue or direct database edits as a
  supported recovery workflow.
- Formats other than PDF and DOCX, files larger than 5 MiB, and profile fields
  outside the existing Candidate Profile aggregate.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Under documented local and production-like test conditions, 100%
  of supported uploads at or below 5 MiB receive an accepted or actionable
  rejected validation result within 5 seconds after the final byte is received.
- **SC-002**: Across the malicious-file verification corpus, 100% of invalid,
  infected, indeterminate, or unscanned files are prevented from reaching
  extraction, semantic parsing, review, and profile confirmation.
- **SC-003**: At least 90% of supported clean text-based CVs produce either a
  review-ready draft or an actionable terminal result within 60 seconds, and
  100% reach an actionable terminal result within 3 minutes under the documented
  provider conditions.
- **SC-004**: Candidates can load a review-ready draft in at most 3 seconds and
  receive visible success, validation, or concurrency feedback for a draft save
  or confirmation in at most 2 seconds, excluding asynchronous upload and parse
  time.
- **SC-005**: In representative usability testing, at least 90% of candidates
  complete upload, review, correction, selective import, and confirmation on the
  first attempt without assistance or unintended profile overwrites.
- **SC-006**: In all concurrency tests, no stale draft edit, stale confirmation,
  duplicate confirmation, or concurrent direct profile save silently loses a
  candidate-authored change or creates a partial/duplicate profile outcome.
- **SC-007**: In all confirmation failure tests, Candidate Profile, its child
  records, the draft, confirmation record, and audit result either all reflect
  one completed import or all remain at their prior valid state.
- **SC-008**: 100% of external parsing dispatches have valid versioned consent
  evidence for the exact upload, provider, and purpose before document content
  leaves the approved private processing boundary.
- **SC-009**: Expired or candidate-deleted artifacts become inaccessible
  immediately, infected/rejected/incomplete artifacts are physically removed
  within 24 hours, unconfirmed imports within 30 days, and confirmed import
  source files, extracted text, complete draft payloads, and provenance within 7
  days of confirmation.
- **SC-010**: Privacy scans of logs, errors, analytics, traces, and audit records
  find zero raw CV content, filenames, contact details, content digests, storage
  locators, consent text, prompts, tokens, sessions, or raw provider/scanner
  responses.
- **SC-011**: All primary upload, progress, review, conflict, retry, manual-entry,
  confirmation, and deletion actions are operable by keyboard, announced with
  meaningful text, and usable without horizontal page scrolling at 320 pixels.
- **SC-012**: At least 99% of expired-artifact cleanup attempts complete without
  manual intervention under the measured test workload, and reconciliation
  identifies every deliberately injected missing or orphaned artifact.

## Assumptions

- Feature 004 reuses the exclusive authenticated browser session, active-account
  enforcement, Candidate Profile aggregate, profile validation rules, safe text
  normalization, audit boundary, and profile revision established by Features
  001 and 002.
- The MVP treats uploaded CVs solely as temporary import sources. A future
  permanent `CandidateDocument` capability requires its own approved scope,
  authorization, retention, and application-attachment behavior.
- The initial malware scanner is a private, fail-closed ClamAV service accessed
  through `clamd`; `freshclam` maintains signatures, Docker Compose provides the
  local service, and production places it on a private network. Planning pins the
  exact image/version, signature-freshness threshold, readiness gate, resource
  limits, and adapter contract. Public sample-sharing submission is prohibited.
- Private temporary file storage and a durable asynchronous worker capability
  are new Feature 004 dependencies. Planning must select their initial providers,
  local-development equivalents, failure behavior, and replacement boundaries.
- PDF and DOCX documents are expected to contain machine-readable text in MVP.
  OCR is deferred, but image-only documents receive an actionable manual path.
- Semantic parsing may be internal or external. External processing is optional,
  cannot occur without exact consent, and cannot disable manual profile editing
  when unavailable.
- Parser output is extraction assistance, not an authoritative statement about
  the candidate and not a recruitment score, recommendation, or decision.
- Existing Candidate Profile collection and per-field limits remain authoritative
  and are not expanded by CV import.
- Test performance targets are measured with documented file corpus, network,
  storage, scanner, parser/provider, worker, database, and hardware conditions.
