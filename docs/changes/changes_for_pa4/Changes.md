# Changes for PA4 — UC Model, Diagrams, and Specifications

**Scope:** `docs/analysis-and-design`  
**Author:** Nguyễn Gia Quốc Uy
**Student ID:** 24127261   
**Reviewers:** Nguyễn Quốc Thành, Ngô Quốc Tuấn  
**Purpose:** Record all changes made to address the instructor's feedback on the UC Model, the five UC Diagrams, and the UC Specifications.  
**Last updated:** 2026-08-06

## 1. Feedback addressed

The changes in this document respond to the following instructor comments:

- The UC model must use a consistent background and must not use dark mode in the report.
- The generalization direction in Diagrams 3 and 5 was incorrect.
- Some `«include»` relationships did not represent the correct behavior, especially `UC-PIPE-03` and `UC-PIPE-02`.
- `«extend»` must not be used to represent a workflow, especially between `UC-POST-02` and `UC-POST-01`.
- Prototype evidence must not be separated from the corresponding UC specification.
- The documentation contained English and editorial errors.

## 2. UC Model and Mermaid Diagram changes

### 2.1. Diagram visual standardization

- Updated all five Mermaid sources:
  - `use_cases/diagrams/diagram_01.md`
  - `use_cases/diagrams/diagram_02.md`
  - `use_cases/diagrams/diagram_03.md`
  - `use_cases/diagrams/diagram_04.md`
  - `use_cases/diagrams/diagram_05.md`
- Converted all diagrams to a light report theme:
  - White or very light canvas/background.
  - Dark, readable text with sufficient contrast.
  - Light colors for system boundaries and subgraphs.
  - Light backgrounds for relationship labels so they remain readable after export.
- Removed dark-canvas and dark-mode settings from the diagram sources and report guidance.
- Standardized classes and styles for actors, use cases, system boundaries, and domain groups.
- Standardized actor names, use-case labels, state names, and relationship labels.

### 2.2. Actor generalization direction

Generalization now follows the UML convention in which the specialized actor points to its parent actor.

- DGM-03:
  - `Recruiter -> Company Member`.
  - `HR Manager -> Company Member`.
  - `Company Owner -> Company Member`.
- DGM-05:
  - `Candidate -> Authenticated User`.
  - `Company Member -> Authenticated User`.
  - `Platform Administrator -> Authenticated User`.
  - `Recruiter -> Company Member`.
- The same convention was applied to DGM-01, DGM-02, DGM-04, and the actor hierarchy in the report.
- Explanatory text was added to clarify that specialized actors inherit the relevant permissions/use cases of their parent actors.

### 2.3. `«include»` and `«extend»` relationship corrections

Relationships that were only describing screen navigation, the next step in a workflow, or a hand-off between independent goals were removed from the diagrams. These connections are now described with preconditions, postconditions, Related Use Cases, or Entry Points.

#### DGM-01

- Retained `UC-AUTH-09 «extend» UC-AUTH-03` because it is conditional behavior when 2FA is enabled.
- Added an explicit condition and extension point: after primary credential validation and before full session creation.
- Removed workflow relationships between registration/email verification, password recovery/login, profile/CV upload, and CV parsing/review.

#### DGM-02

- Removed navigation relationships such as selecting a job from the list to view job details, and save/share/report/apply actions from job details.
- Removed navigation relationships for selecting a saved job or recommendation.
- Documented these connections as Related Use Cases and Entry Points instead of `«include»`/`«extend»` relationships.
- Kept the diagram focused on independent candidate goals.

#### DGM-03

- Removed `UC-POST-02 «extend» UC-POST-01`.
- Removed `UC-POST-03 «extend» UC-POST-02`.
- Removed `UC-PIPE-02 «extend» UC-PIPE-01`.
- Removed `UC-PIPE-03 «include» UC-PIPE-02`.
- Clarified that `UC-PIPE-02` updates the candidate stage and creates the history event in the same transaction.
- Clarified that `UC-PIPE-03` is a read-only stage-history query; history is created by valid stage-transition sources.
- Defined an available screening result as a precondition for `UC-SCR-03`; asynchronous screening is not an `«include»` of applicant review.

#### DGM-04

- Removed `UC-USER-02 «extend» UC-USER-01`.
- Removed `UC-MOD-02 «extend» UC-MOD-01`.
- Documented account enforcement and moderation decisions as related goals after review, rather than as workflow `«extend»` relationships.

#### DGM-05

- Retained `UC-SCR-04 «extend» UC-SCR-01` with the condition `[screening failed; retry selected]`.
- Retained `UC-ANL-03 «extend» UC-ANL-01` and `UC-ANL-03 «extend» UC-ANL-02` with the condition `[Export selected]`.
- Removed `UC-NOT-03 «extend» UC-NOT-01`; notification retry is an independent system-recovery process linked through Related Use Cases.

### 2.4. `Use_Case_Model.md` synchronization

- Updated the Mermaid blocks for all five diagrams in `use_cases/Use_Case_Model.md`.
- Replaced the DGM-03 block in `Use_Case_Model.md` with the canonical block from `diagrams/diagram_03.md`.
- DGM-03 is now consistent in terms of:
  - `flowchart LR`.
  - `direction TB` inside the Posting, Screening, and Pipeline groups.
  - Generalization labels.
  - The `UC-SCR-01` label.
  - Classes, styles, and stroke widths.
- The source blocks for DGM-01 through DGM-05 now substantively match the corresponding blocks in `Use_Case_Model.md`.

## 3. UC Specification changes

### 3.1. Standardization of the 53 UC specifications

The five domain-specific specification files were updated:

- `use_cases/specification/01_Identity_Access_Profile.md` — 16 UCs.
- `use_cases/specification/02_Candidate_Job_Journey.md` — 9 UCs.
- `use_cases/specification/03_Recruiter_Operations.md` — 9 UCs.
- `use_cases/specification/04_Administration_Moderation.md` — 10 UCs.
- `use_cases/specification/05_Services_Analytics.md` — 9 UCs.

There are **53 UCs** in total. They now follow a common structure:

1. Use-Case Information.
2. Brief Description and Preconditions.
3. Basic Flow.
4. Alternative/Error Flows.
5. Postconditions and Special Requirements.
6. Prototype Evidence.
7. Related Use Cases and Entry Points.

### 3.2. Prototype evidence placement

- Prototype evidence was placed directly inside the corresponding UC specification.
- Verification confirms that **53/53 UCs contain direct Prototype Evidence**.
- Captions were added or standardized so that each image maps to a Basic Flow, Alternative Flow, Exception Flow, or specific state.
- The `*-Prototype-Coverage.md` files remain indexes/traceability appendices; they are no longer the only location containing UC evidence.
- DGM-03 coverage and supplementary links in `Tuan-Prototype.html` were updated.
- DGM-04 and DGM-05 mappings between UCs, flow/state descriptions, and prototype images were updated.

### 3.3. English and editorial corrections

- Standardized actor and system names: `Company Owner`, `Platform Administrator`, `Authenticated User`, `CV Parsing Service`, and `File Scanning Service`.
- Standardized use-case names and states: `Log In`, `Log Out`, `Manage Account Preferences`, `Draft`, `Pending Review`, `Published`, `Paused`, `Closed/Archived`, `Processing`, `Failed`, and `Completed`.
- Distinguished real actors, supporting actors, recipients, and stakeholders.
- Reworded flows so that screen navigation is not described as a UML relationship.
- Corrected issues including:
  - `selecting a jobs` → `selecting a job`.
  - `job informations` → `job information`.
  - `folder same with this file` → `the same folder as this file`.
  - `usecase` → `use case`.
  - Inconsistent `LogOut`/`Login` naming and role capitalization.
  - Incorrect or skipped AF/EF numbering.
  - Extra spaces before periods and incomplete sentences.
- Synchronized actors, triggers, preconditions, postconditions, relationship summaries, and prototype captions between the split and consolidated specifications.

### 3.4. Consolidated specification update

- Updated `use_cases/Specification.md` from the five domain specifications.
- Updated actor/UC/prototype mapping tables.
- Updated relationship descriptions to reflect the corrected UML decisions.
- Updated DGM-03, DGM-04, and DGM-05 render links to lowercase PNG assets.

## 4. Render assets and path changes

### 4.1. New asset naming convention

The render assets now follow this single convention:

```text
rendered_diagrams/diagram_01.png
rendered_diagrams/diagram_02.png
rendered_diagrams/diagram_03.png
rendered_diagrams/diagram_04.png
rendered_diagrams/diagram_05.png
```

The following changes were made:

- Removed the old JPG assets:
  - `diagram_01.jpg`.
  - `Diagram_02.jpg`.
  - `Diagram_03.jpg`.
- Changed DGM-03 references from `Diagram_03.jpg` to `diagram_03.png`.
- Changed DGM-04 references from `Diagram_04.png` to `diagram_04.png`.
- Changed DGM-05 references from `Diagram_05.png` to `diagram_05.png`.
- Updated the asset list in `docs/analysis-and-design/plan.md`.
- Re-rendered DGM-03 after synchronizing its source and report model.
- Verified that all five PNG assets exist, use a white background, and have valid render dimensions.

### 4.2. Files with updated asset references

- `use_cases/Use_Case_Model.md`.
- `use_cases/Specification.md`.
- `use_cases/specification/03_Recruiter_Operations.md`.
- `use_cases/specification/04_Administration_Moderation.md`.
- `use_cases/specification/05_Services_Analytics.md`.
- `docs/analysis-and-design/plan.md`.

## 5. Removal of stale PDF snapshots

To avoid keeping PDF snapshots that were no longer synchronized with the Markdown sources, the following files were removed:

- `use_cases/prototypes/DGM-05-Services-Analytics/05_Prototype-Coverage.pdf`.
- `use_cases/specification/05_Services_Analytics.pdf`.

The Markdown/source files are now the sources to use when PDFs are needed for the report.

## 6. Post-change verification

Current QA results:

- Mermaid source/model for DGM-01 through DGM-05: substantively matched.
- DGM-03 source/model: exact match.
- Broken local Markdown links: **0**.
- References to old render assets: **0**.
- Known invalid relationship patterns: **0**.
- Dark-theme references in Markdown: **0**.
- UC sections: **53**.
- UCs with direct Prototype Evidence: **53/53**.
- All five lowercase PNG assets exist and have a white background.
- No files under `spec-kit`, `.agents`, or other Speckit-related locations were modified.

## 7. Files updated or handled

### UC model and diagrams

- `docs/analysis-and-design/use_cases/Use_Case_Model.md`.
- `docs/analysis-and-design/use_cases/diagrams/diagram_01.md` through `diagram_05.md`.
- `docs/analysis-and-design/use_cases/diagrams/rendered_diagrams/diagram_01.png` through `diagram_05.png`.
- Old JPG render assets were removed.

### Specifications

- `docs/analysis-and-design/use_cases/Specification.md`.
- `docs/analysis-and-design/use_cases/specification/01_Identity_Access_Profile.md`.
- `docs/analysis-and-design/use_cases/specification/02_Candidate_Job_Journey.md`.
- `docs/analysis-and-design/use_cases/specification/03_Recruiter_Operations.md`.
- `docs/analysis-and-design/use_cases/specification/04_Administration_Moderation.md`.
- `docs/analysis-and-design/use_cases/specification/05_Services_Analytics.md`.

### Prototype traceability

- `DGM-01-Identity-Access-Profile/01_Prototype-Coverage.md`.
- `DGM-02-Candidate-Job-Journey/02_Prototype-Coverage.md`.
- `DGM-03-Recruiter-Operations/03_Prototype-Coverage.md`.
- `DGM-03-Recruiter-Operations/Tuan-Prototype.html`.
- `DGM-04-Company-Administration/04_Prototype-Coverage.md`.
- `DGM-05-Services-Analytics/05_Prototype-Coverage.md`.

### Independent planning document

- `docs/analysis-and-design/plan.md` was created as a standalone plan and implementation checklist.
- No Speckit `plan.md` file was used or modified.

## 8. Final QA note

The main issues identified by the instructor have been addressed. During the final review, the actor-generalization sentence in `use_cases/Specification.md` should use the correct UML terminology:

```text
Actor generalization arrows point from the specialized actor to the parent actor.
```

If this sentence has not yet been replaced in the final working copy, update it before closing PA4. The DGM headings in the consolidated report should also use the same dash style (`—`) if fully consistent typography is required.
