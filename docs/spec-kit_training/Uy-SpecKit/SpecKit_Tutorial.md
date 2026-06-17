# Student Information

* **Student Name:** Nguyễn Gia Quốc Uy
* **Student ID:** 24127261
* **Class:** 24C11
* **Author:** Nguyễn Gia Quốc Uy
* **Editor:** Nguyễn Gia Quốc Uy
* **Reviewer:** Group 9

---

# Table of Contents

- [Spec-Driven Development (SDD) Framework](#spec-driven-development-sdd-framework)
  - [1. `constitution.md` (Project Constitution)](#1-constitutionmd-project-constitution)
  - [2. `spec.md` (Functional Specification - "Specify")](#2-specmd-functional-specification---specify)
  - [3. `plan.md` (Technical Plan - "Plan")](#3-planmd-technical-plan---plan)
  - [4. `tasks.md` (Technical Blueprint - "Task")](#4-tasksmd-technical-blueprint---task)
  - [5. `clarify.md` (Requirement Clarification - "Clarify")](#5-clarifymd-requirement-clarification---clarify)
  - [6. `analyze.md` (In-Depth Analysis - "Analyze")](#6-analyzemd-in-depth-analysis---analyze)
  - [7. Project Folder Structure Tree](#7-project-folder-structure-tree)

---

# Spec-Driven Development (SDD) Framework

- **Core Concept:** The **Spec-Driven Development (SDD)** methodology implemented by Spec Kit divides the software development lifecycle into clear, structured phases. The core objective is **"Think before you code"** to prevent the AI agent from writing incorrect code or drifting from the original requirements.

---

## 1. `constitution.md` (Project Constitution)
- **Meaning:** 
  - The supreme and immutable law of the entire project. 
  - It defines the general rules that the AI must strictly follow, preventing the AI from changing technologies arbitrarily or writing messy code.
- **Internal Structure:**
  - **Core Principles:** The core development philosophy of the project.
  - **Fixed Tech Stack:** Defines the mandatory tech stack and libraries if they are fixed and should not be changed.
  - **Coding Standards:** Naming conventions (e.g., `camelCase` for variables, `PascalCase` for components), error handling conventions, file and folder naming rules, etc.
  - **Git Workflow:** Rules for Git branching (e.g., `feature/branch-name`) and commit message formats (e.g., Conventional Commits).
  - **Testing & Security:** Policies for writing unit tests (e.g., minimum coverage requirements) and security constraints.

---

## 2. `spec.md` (Functional Specification - "Specify")
- **Meaning:**
  - Focuses entirely on answering **WHAT** is being built and **WHY** it is needed. 
  - It describes the **system's business logic** and **MUST NOT** contain any technical details or code.
- **Internal Structure:**
  - **Feature Overview:**
    - Feature Name.
    - A 1-2 sentence description of the feature and its purpose.
    - The business or technical context behind this requirement.
  - **User Stories:**
    - Simple descriptions of the feature from the user's perspective.
    - **Structure:** *As a [user role], I want to [action/feature], So that [benefit/value received].*
    - **Priority Levels:**
      - Categorize functional requirements into priorities from P1 to P3:
        - **P1 (Must-Have):** Mandatory requirements. The feature cannot function or be used without them.
        - **P2 (Should-Have):** Highly recommended for a complete user experience. The system still runs without them, but the user experience will be poor or inconvenient.
        - **P3 (Could-Have):** Nice-to-have features, typically animations, minor decorations, or non-essential tools. These can be skipped if time is limited.
      - **Execution Rule:** Force the AI to complete all P1 tasks first. Once the core P1 flow runs successfully without errors, proceed to P2 and then P3.
  - **Functional Requirements (FR):**
    - A list of system behaviors. Do not describe technical implementation; focus only on behavior.
    - **4 Rules for writing FRs:**
      - Must have a unique ID (e.g., `REQ-01`, `FR-01`).
      - Must have a priority label (P1, P2, P3).
      - Must start with system-action phrases (e.g., *"The system must..."*).
      - Must be testable and must not leak technology stack details.
    - Each requirement should be presented in a table for readability and easy comparison by priority.
  - **Out of Scope:**
    - List what will NOT be done in this feature to prevent the AI from self-inventing or doing extra, unnecessary work.
  - **Success Criteria:**
    - Measurable outcomes (how the feature behaves when working correctly, including concrete metrics or test scenarios).
    - Focused entirely on the user experience.

---

## 3. `plan.md` (Technical Plan - "Plan")
- **Meaning:**
  - Translates the business requirements of `spec.md` into a **technical architecture and design blueprint** before programming.
  - Shifts the focus from **What & Why → How**.
  - Each feature has its own independent `spec.md` and `plan.md`.
- **Internal Structure:**
  - **Section 1: Feature Flow:** The execution and data flow diagram/steps specific to this feature.
  - **Section 2: Tech Stack Decision:** Lists the specific technologies, libraries, or packages chosen for this feature.
  - **Section 3: Files to Create & Modify:** Lists only the files and directories that need to be created or modified for this feature.
  - **Section 4: Data Models:** Detailed schema for each database entity, including field names, data types, constraints, and relationships. (Can be moved to a separate file if too complex).
  - **Section 5: API Contract:** The technical agreement defining exactly how data enters and leaves the system.
    - **REST API:** Specify HTTP method, route path, request body, response body, and all possible HTTP status codes.
    - **GraphQL:** Define types, queries, and mutations.
  - **Section 6: Research Decision:** Records the reasoning behind major technical choices (problems to solve, alternatives considered, final decision, and justification).
  - **Section 7: Verification Plan:** Testing plan containing automated tests and manual steps to verify that the feature works correctly from an end-user perspective.

---

## 4. `tasks.md` (Technical Blueprint - "Task")
- **Meaning:**
  - The step where the AI automatically breaks down `plan.md` into a sequential, detailed checklist of actionable tasks that can be executed step-by-step.
- **Inputs:**
  - The AI does not need direct user input; it automatically reads:
    - `spec.md` — to understand user stories and functional requirements.
    - `plan.md` — to understand technical architecture and file structures.
    - `constitution.md` — to ensure tasks do not violate project rules.
    - Any other files as needed.
- **Output:**
  - An independent task list file for the feature, divided into logical **Phases**.
  - Each phase contains 2-3 numbered tasks.
- **Task Structure:**
  - **Task ID & Name:** A unique identifier and a short name describing the task.
  - **Detailed Description:** Clear instructions on what code to write/modify.
  - **Dependencies:** Lists which task(s) must be completed before starting this task.

---

## 5. `clarify.md` (Requirement Clarification - "Clarify")
- **Meaning:**
  - The AI reads the newly created `spec.md` to identify ambiguities, gaps, or missed edge-cases. It then asks questions to resolve them.
  - The user's answers are updated directly back into `spec.md`.
- **Interaction Format:**
  - The AI asks 3-5 questions sequentially (one at a time).
  - Each question includes multiple-choice suggested answers, or the option to write a custom answer.
- **Output:**
  - Once completed, a new section named "Clarifications" is appended to the end of `spec.md`.

---

## 6. `analyze.md` (In-Depth Analysis - "Analyze")
- **Meaning:**
  - An optional quality-assurance step.
  - The AI reads all generated artifacts (`spec.md`, `plan.md`, `tasks.md`) and cross-checks them to find contradictions, logical gaps, or violations of the project constitution before implementation.
- **Issues Identified by Analyze:**
  - Project constitution violations.
  - Inconsistencies between `spec.md` and `plan.md`.
  - Task ordering or dependency errors.

---

## 7. Project Folder Structure Tree

Below is the directory layout showing how Spec Kit files are organized inside a project repository:

```text
Software-Engineering---Group-9/ <-- Your project root directory
├── .agents/
│   └── skills/                  # Contains command instructions for Antigravity (agy)
├── .specify/
│   ├── memory/
│   │   └── constitution.md      # Project CONSTITUTION file (here!)
│   └── templates/               # Sample template files
├── specs/                       # Directory of features
│   ├── 001-user-login/
│   │   ├── spec.md              # Functional Specification (What/Why)
│   │   ├── plan.md              # Technical Design (How)
│   │   └── tasks.md             # Checklist of implementation tasks
│   └── 002-shopping-cart/
│       ├── spec.md
│       ├── plan.md
│       └── tasks.md
├── src/                         # Main source code directory
└── README.md
```