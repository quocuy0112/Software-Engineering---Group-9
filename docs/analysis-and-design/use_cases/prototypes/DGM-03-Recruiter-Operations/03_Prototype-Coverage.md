# Prototype Coverage & Traceability - Diagram 3 (Recruiter Operations)

> **Canonical stage note:** Prototype images may retain early visual labels,
> but implementation and acceptance review use Applied, Viewed, Shortlisted,
> Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted. AI
> scoring status is displayed separately from recruitment stage.

# Student Information

**Student Name:** Ngô Quốc Tuấn
**Student ID:** 24127581
**Group:** 09
**Class:** 24C11
**Course/Project:** Software Engineering
**Review:** Nguyễn Gia Quốc Uy
---


---

This document describes in detail the use cases belonging to three domains: **Job Posting Management**, **Applicant Screening & Ranking**, and **Recruitment Pipeline**, and maps the flows in the Use Case Specification to their corresponding Prototype Evidence (screenshots), following the project's Traceability Validation Rules.

> **Principle Note**
> - 1 Use Case ≠ 1 single screen. Several base screens are reused across multiple use cases and alternative flows, differentiated only by a state change or a small component variation.
> - `UC-SCR-01: Execute Hybrid Candidate Screening` belongs to the scope of **Diagram 5 (Supporting Services and Analytics)**. DGM-03 shows the recruiter-facing processing and failure states directly; refer to the Diagram 5 document for the complete service flow and corresponding `UI_01_*` evidence.
> - To support evaluation and demoing, an interactive HTML prototype (`prototype.html`) — featuring a mermaid diagram, role-based filtering, and the screen states for every use case listed below — is attached alongside this document.

> **Legend:** `AF` = Alternative Flow · `BF` = Basic Flow (used interchangeably with "Basic Flow" in the tables below)

## Diagram Scope: Job Posting, Applicant Screening & Recruitment Pipeline

| Use Case ID | Use Case Name | Domain |
| :--- | :--- | :--- |
| **UC-POST-01** | Create and Manage Job Draft | Job Posting Management |
| **UC-POST-02** | Preview and Submit Job Posting | Job Posting Management |
| **UC-POST-03** | Manage Job-Posting Lifecycle | Job Posting Management |
| **UC-POST-04** | View Company Job Postings | Job Posting Management |
| **UC-SCR-03** | Review and Rank Applicants | Applicant Screening & Ranking |
| **UC-PIPE-01** | View Recruitment Pipeline Kanban Board | Recruitment Pipeline |
| **UC-PIPE-02** | Update Candidate Recruitment Stage | Recruitment Pipeline |
| **UC-PIPE-03** | View Application Stage History | Recruitment Pipeline |

> **Note:** `UC-SCR-01` is listed in the scope because DGM-03 contains recruiter-facing evidence. The complete asynchronous service specification remains owned by Diagram 5.

---

## 1. Use Case Description

### 1.1 Job Posting Management

#### UC-POST-01: Create and Manage Job Draft
- **Actors:** Recruiter (Authorized), HR Manager (Authorized)
- **Description:** Allows the Recruiter/HR Manager to create, edit, or delete a job posting draft before submitting it for approval.
- **Precondition:** The user is logged in and holds the `Recruiter` or `HR Manager` role within the company.
- **Basic Flow:** The user fills in the job posting information (title, department, location, job description, etc.) and saves it as a draft.
- **Alternative Flow:**
  - Reopen a previously saved draft to continue editing it.
  - Delete an unpublished draft (with a confirmation step before deletion).
- **Postcondition:** The draft is saved with a `Draft` status, ready for UC-POST-02.
#### UC-POST-02: Preview and Submit Job Posting
- **Actors:** Recruiter (Authorized), HR Manager (Authorized)
- **Related Use Case:** UC-POST-01 creates the draft used as the entry point for this goal.
- **Description:** Allows the user to preview the job posting exactly as candidates will see it, then submit it for approval.
- **Basic Flow:** The user previews the posting, confirms the content, and clicks "Submit for approval"; the status changes to `Pending Review`.
- **Alternative Flow:** The system blocks the submission and displays an error if a required field is missing (e.g., salary range, application deadline).
- **Postcondition:** The posting's status changes to `Pending Review`, awaiting processing in UC-POST-03.
#### UC-POST-03: Manage Job-Posting Lifecycle
- **Actors:** Recruiter, HR Manager, Company Owner (all Authorized)
- **Related Use Case:** UC-POST-02 submits a posting that can later enter this lifecycle-management goal.
- **Description:** Manages the entire lifecycle of a job posting after it has been submitted for approval: approve/publish, reject, close, or archive.
- **Basic Flow:** The HR Manager/Owner approves a posting that is `Pending Review` → the posting's status changes to `Published`.
- **Alternative Flow:**
  - Close/archive a posting that has been fully staffed or has expired → status changes to `Archived`.
  - Reject a posting, with a reason noted → the posting returns to `Draft` status.
- **Postcondition:** The posting's status accurately reflects its current lifecycle state (`Draft` / `Pending Review` / `Published` / `Archived` / `Rejected`).
#### UC-POST-04: View Company Job Postings
- **Actors:** Recruiter, HR Manager, Company Owner
- **Description:** View the full list of the company's job postings along with their statuses, with the option to filter by status.
- **Basic Flow:** Displays the list of postings with their corresponding status badges.
- **Alternative Flow:** Displays an empty state when the company has no job postings yet.
- **Postcondition:** The list accurately reflects the current status of every posting in the company.
### 1.2 Applicant Screening & Ranking

#### UC-SCR-03: Review and Rank Applicants
- **Actors:** Recruiter (Authorized), HR Manager (Authorized)
- **Precondition:** UC-SCR-01 has completed successfully and returned a usable score for the candidate.
- **Description:** Allows the Recruiter/HR Manager to view the list of candidates already scored and ranked by the AI system, to support screening decisions.
- **Precondition:** UC-SCR-01 has executed successfully and returned a score for the candidate.
- **Basic Flow:** Displays the list of candidates sorted by AI score in descending order, along with a résumé summary.
- **Alternative Flow:** The user overrides the AI-suggested ranking, manually prioritizing a candidate.
- **Postcondition:** The ranked list (whether overridden or not) is used as input for the Recruitment Pipeline.
### 1.3 Recruitment Pipeline

#### UC-PIPE-01: View Recruitment Pipeline Kanban Board
- **Actors:** Recruiter, HR Manager, Company Owner
- **Description:** Displays a Kanban board of candidates organized by the canonical recruitment stages (Applied, Viewed, Shortlisted, Interviewing, Offered, Hired, Offer Declined, Rejected, and Waitlisted).
- **Basic Flow:** The system displays stage columns with the corresponding candidate cards.
- **Alternative Flow:** Filter the kanban board by a specific job posting.
- **Postcondition:** The board accurately reflects the current stage of every active candidate for the selected posting(s).
#### UC-PIPE-02: Update Candidate Recruitment Stage
- **Actors:** Recruiter (Authorized), HR Manager (Authorized)
- **Related Use Case:** UC-PIPE-01 provides the board entry point for changing a candidate stage.
- **Description:** Allows updating a candidate's recruitment stage, typically via a drag-and-drop action on the kanban board.
- **Basic Flow:** Drag the candidate's card from the current column to the next stage column; the system logs the change.
- **Alternative Flow:** Move the candidate to the `Rejected` stage, requiring a rejection reason to be entered.
- **Postcondition:** The new stage is saved, and a history record is created (input for UC-PIPE-03).
#### UC-PIPE-03: View Application Stage History
- **Actors:** Recruiter, HR Manager, Company Owner
- **Data dependency:** UC-PIPE-02 creates a history record atomically with each successful stage update; this goal only reads the history.
- **Description:** View the timeline of all stage changes for an application, including the time and the person who performed the action.
- **Basic Flow:** Displays a chronological timeline: stage, transition time, and the actor who performed the update.
- **Postcondition:** The full, ordered history of stage transitions is visible for the selected application.
---

## 2. Coverage Matrix

| Use Case ID | Specification Flow | Prototype Evidence (Filename) | State / Reuse |
| :--- | :--- | :--- | :--- |
| **UC-POST-01** | BF: Create a job posting draft | `UC_POST_01_Create_Job_Draft.png` | Job draft base screen, new-entry form, `Draft` badge |
| **UC-POST-01** | AF: Invalid input data | `UC_POST_01_Validate_Error.png` | (Reuse `UC_POST_01_Create_Job_Draft.png`) + red-outlined invalid field & validation message |
| **UC-POST-02** | BF: Preview & submit for approval | `UC_POST_02_Preview_And_Submit.png` | Preview base screen + "Submit for approval" button |
| **UC-POST-02** | AF: Duplicate job posting title warning | `UC_POST_02_Preview_Duplicate_Title_Warning.png` | (Reuse the Preview screen) + banner warning of a title duplicate with an existing posting |
| **UC-POST-03** | BF: Open the actions menu (approve/reject/close/pause) | `UC_POST_03_Actions_Menu.png` | List row + actions menu (⋮) on a posting |
| **UC-POST-03** | State: List filtered by `Draft` status | `UC_POST_03_Filter_List_Draft.png` | Postings list + `Draft` filter selected |
| **UC-POST-03** | State: List filtered by `Pending Review` status | `UC_POST_03_Filter_List_Pending_Review.png` | Postings list + `Pending Review` filter selected |
| **UC-POST-03** | State: List filtered by `Published` status | `UC_POST_03_Filter_List_Published.png` | Postings list + `Published` filter selected |
| **UC-POST-03** | State: List filtered by `Paused` status | `UC_POST_03_Filter_List_Paused.png` | Postings list + `Paused` filter selected |
| **UC-POST-03** | State: List filtered by `Closed` status | `UC_POST_03_Filter_List_Closed.png` | Postings list + `Closed` filter selected |
| **UC-POST-04** | BF: View the company's job postings list | `UC_POST_04_View_Company_Job_Postings.png` | Full list, unfiltered, multiple statuses interleaved |
| **UC-SCR-01** *(ref. Diagram 5)* | BF: The AI system is scoring | `UC_SCR_01_AI_Scanning.png` | Evaluation base screen + loading/scanning indicator |
| **UC-SCR-01** *(ref. Diagram 5)* | AF: Scoring failed | `UC_SCR_01_Scoring_Failed.png` | Evaluation base screen + scoring-failure message |
| **UC-SCR-03** | BF: List of ranked candidates | `UC_SCR_03_Ranked_Candidates.png` | Candidate list sorted by AI score in descending order |
| **UC-SCR-03** | State: Results ready to review | `UC_SCR_03_Ready.png` | (Reuse `UC_SCR_03_Ranked_Candidates.png`) + "Ready to review" badge |
| **UC-SCR-03** | AF: Move a candidate to the Offer stage | `UC_SCR_03_Advanced_To_Offer.png` | Rank row + "Advance to Offer" action |
| **UC-SCR-03** | AF: Reject a candidate | `UC_SCR_03_Reject.png` | Rank row + "Reject" action |
| **UC-PIPE-01** | BF: Kanban board by stage | `UC_PIPE_01_Kanban_Board.png` | All stage columns shown, with full action permissions |
| **UC-PIPE-01** | AF: Company Owner viewing in read-only mode | `UC_PIPE_01_Kanban_Board_Owner_View_Only.png` | (Reuse `UC_PIPE_01_Kanban_Board.png`) + drag-and-drop actions hidden, view only |
| **UC-PIPE-02** | BF: Drag and drop a candidate's card to another column | `UC_PIPE_02_Drag_And_Drop_Card.png` | Candidate card shown mid-drag (dragging state) |
| **UC-PIPE-02** | BF: Confirm the stage update | `UC_PIPE_02_Move_Stage.png` | Toast/confirmation message that the stage change succeeded |
| **UC-PIPE-03** | BF: Application history log | `UC_PIPE_03_Stage_History.png` | Timeline of stage changes in chronological order |

---

## 3. Traceability Summary

| Domain | Use Cases | Evidence Files | Reused Base Screens |
| :--- | :--- | :--- | :--- |
| Job Posting Management | UC-POST-01 → 04 | 11 | 2 (Draft form, Preview shell) |
| Applicant Screening & Ranking | UC-SCR-03 (incl. UC-SCR-01 ref.) | 6 | 1 (Ranked candidates list) |
| Recruitment Pipeline | UC-PIPE-01 → 03 | 5 | 1 (Kanban board) |
