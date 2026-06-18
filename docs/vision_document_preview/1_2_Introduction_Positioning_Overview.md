# Student Information

**Họ và tên:** Ngô Quốc Tuấn&nbsp;

**Mã số sinh viên:** 24127581&nbsp;

**Lớp:** 24C11&nbsp;

---

# SmartHire – Product Documentation
---
 
## Introduction
 
### Purpose
 
This document defines the product positioning for **SmartHire** — an AI-assisted applicant tracking system built for small and medium-sized enterprises (SMEs) in Vietnam. It serves as a foundational reference for the product team, ensuring all members share a consistent understanding of the problem being solved, the target audience, and the strategic rationale behind the product's design and direction.
 
The document is intended for internal use across product, design, and development functions. It should be consulted at the start of any feature discussion, sprint planning session, or stakeholder presentation to maintain alignment between what is being built and why.
 
### References
 
| # | Source | Description |
|---|---|---|
| 1 | Moore, G. A. — *Crossing the Chasm* (1991) | Origin of the Product Position Statement framework used in this document. The template structures a product's market position across six dimensions: target customer, pain point, product category, core benefit, competitive alternatives, and key differentiator. |
| 2 | Ries, E. — *The Lean Startup* (2011) | Informs the problem-first approach taken in the Problem Statement section — defining validated pain points before solution design. |
| 3 | Vietnam Ministry of Planning and Investment — SME Report (2023) | Contextual data on the scale of SMEs in Vietnam and their operational constraints, used to validate the target market definition. |
| 4 | TopCV, ITviec — Public platform documentation | Referenced as competitive alternatives in the Product Position Statement. |
 
### Document Structure
This document is organised into two core positioning frameworks, each presented as a structured table:

**1. Positioning**
 
| Section | Description |
|---|---|
| **Problem Statement** | Defines the specific problem this product exists to solve, who is affected, what the consequences of inaction are, and what a successful solution would look like. |
| **Product Position Statement** | Defines the product's strategic market position — who it is for, what pain it resolves, what category it belongs to, why users should choose it, how it differs from alternatives, and what makes it uniquely valuable. |
 
**2. Problem Statement** — presented in a structured table:
 
| Section | Description |
|---|---|
| **The problem of** | What is the specific problem or issue being addressed? |
| **Affects** | Who is affected, and what elements or factors are impacted? |
| **The impact of which is** | What is the negative impact or consequence of this problem? |
| **A successful solution would be** | What would a successful solution achieve? |
 
**3. Product Position Statement** — presented in a structured table:
 
| Section | Description |
|---|---|
| **For** | Target customers — who is the target audience? |
| **Who** | What pain points or difficulties do they need resolved? |
| **The SmartHire** | Product name and product category or type. |
| **That** | What is the core benefit? Why should they buy and use this product? |
| **Unlike** | How does it differ from current competitors or existing solutions? |
| **Our product** | In what way is your product superior or unique? |
 
---
 
## Problem Statement

| Field | Details |
|---|---|
| **The problem of** | SMEs in Vietnam managing their entire recruitment process manually — through email threads, spreadsheets, and disconnected tools — with no structured way to track, screen, or evaluate candidates at scale. Most HR teams at this company size rely on a combination of email inboxes, shared Google Sheets, and manual CV sorting. There is no single system of record: candidate data is scattered, duplicated, and version-controlled inconsistently across team members. When a recruiter is absent or leaves, institutional knowledge about candidates disappears with them. |
| **Affects** | **HR staff & recruiters** spend a disproportionate amount of time on administrative tasks — sorting inboxes, updating spreadsheets, manually sending status emails — instead of focusing on candidate quality and relationship-building. **Hiring managers** lack visibility into the pipeline; they typically only get involved late in the process, when shortlists are presented without context on how candidates were evaluated. **Job candidates** apply and then wait in silence — often receiving no confirmation, no updates, and no rejection notice. This damages the employer brand, especially for SMEs competing with larger companies for talent. **Business leadership** cannot make data-informed hiring decisions because no structured recruitment data is being captured; there are no metrics on time-to-hire, source effectiveness, or funnel conversion. |
| **The impact of which is** | **Slow time-to-hire:** Manual CV review is serial and inconsistent — different reviewers apply different criteria. A recruiter handling 50+ applicants per role often makes rushed decisions or misses qualified candidates buried in the inbox. **Missed or deprioritised talent:** Without objective scoring, candidate ranking is driven by availability bias — whoever was reviewed most recently or whose email appeared first gets more attention. Strong candidates who applied early can stagnate. **Recruiter burnout and inefficiency:** Repetitive tasks such as copy-pasting candidate data, sending templated acknowledgement emails, and reformatting CVs for hiring managers consume hours that could be redirected to sourcing and interviews. **Poor candidate experience:** Applicants frequently cite lack of communication as the top frustration in job searches. SMEs that fail to acknowledge or update candidates risk damaging their reputation in increasingly transparent talent markets. **Zero hiring intelligence:** Because no structured data is collected, organisations cannot answer basic questions — Where are our best hires coming from? How long does each stage take? Which roles have the highest drop-off? — making every new hiring cycle feel like starting from scratch. |
| **A successful solution would be** | A centralised web platform that automates candidate screening, provides recruiters with a visual pipeline to manage applicants, notifies candidates automatically at each stage, and gives admins an oversight dashboard — while also helping candidates discover the most relevant job openings through AI-powered recommendations. **Success means:** recruiters spend less than 20% of their time on administrative tasks; no qualified candidate is missed due to process failure; every applicant receives timely, relevant communication without manual effort; and leadership has access to a live dashboard that answers key hiring performance questions. The solution must be lightweight enough for SMEs to adopt immediately — no lengthy procurement cycles, no IT setup required, no per-seat enterprise pricing. It should feel as intuitive as the tools teams already use, while delivering capabilities that are currently completely out of reach for businesses of this size. |

---

## Product Position Statement

| Field | Details |
|---|---|
| **For** | Small and medium-sized enterprises (SMEs) in Vietnam that are actively hiring but lack a structured recruitment system. This primarily covers companies with 10–500 employees, across industries such as technology, retail, logistics, education, and services — sectors experiencing rapid headcount growth but without the budget or technical capacity to implement enterprise HR software. These companies typically have 1–3 HR staff managing the full recruitment cycle, often alongside other HR responsibilities. |
| **Who** | Struggle with high volumes of unstructured job applications, time-consuming manual CV review, no standardised way to rank candidates, and poor visibility into where each applicant stands in the hiring process. Specifically: they post jobs on platforms like TopCV or Facebook but have no structured way to receive, organise, or evaluate responses. All communication happens through a shared email inbox or personal accounts. Evaluation is entirely subjective — scores and impressions live in someone's head or in a private spreadsheet, never shared or auditable. When candidates ask for an update, HR staff must manually check multiple sources to give an answer. |
| **The SmartHire** | AI-assisted ATS platform. A responsive web application combining an applicant tracking system with AI-powered job recommendations, purpose-built for the Vietnamese SME market. SmartHire operates fully in the browser — no installation, no IT dependencies — and is designed to be usable by a non-technical HR team from day one. The platform serves two primary user groups simultaneously: recruiters and hiring managers who need to manage, evaluate, and move candidates through a structured pipeline; and job seekers who need help discovering the right roles without relying on keyword search alone. |
| **That** | Gives recruiters a structured ATS with a drag-and-drop Kanban pipeline to manage applicants and automated email notifications at every stage — while helping candidates find the right opportunities through AI-powered job recommendations matched to their profile and CV. For recruiters: the system auto-scores incoming CVs against job criteria, surfaces the strongest candidates at the top of the queue, and sends templated status emails automatically when a candidate moves between stages — eliminating the need for manual communication at every step. For candidates: instead of browsing and filtering dozens of irrelevant listings, SmartHire analyses their uploaded CV and stated preferences to surface the roles they are most likely to be qualified for and interested in — reducing mismatched applications on both sides. |
| **Unlike** | **Enterprise ATS tools (Workday, Greenhouse)** — designed for large organisations with dedicated HR operations teams; priced and structured for companies with hundreds of open roles at a time; too complex and expensive for SME adoption. **Generic job boards (TopCV, ITviec)** — focused purely on the candidate-facing experience; provide no tooling for the recruiter side; do not help companies manage, evaluate, or communicate with applicants after they apply. **Manual email + spreadsheet workflows** — zero structured data, fully dependent on individual effort and discipline; do not scale; create single points of failure; provide no auditability or reporting. |
| **Our product** | Is purpose-built for Vietnamese SMEs — affordable, zero-install, and uniquely uses AI to recommend the most suitable job postings to candidates based on their profile and CV. Unlike generic job boards that rely on keyword search, SmartHire surfaces the right opportunities automatically, reducing mismatched applications and helping recruiters focus on genuinely qualified candidates. From the recruiter's perspective, SmartHire replaces an entire stack of disconnected tools with a single workflow: post a role → receive and auto-score applications → manage candidates through a visual pipeline → communicate with candidates automatically → review pipeline performance in a live dashboard. From the candidate's perspective, SmartHire replaces passive browsing with active matching: upload a CV → receive personalised role recommendations → track application status in real time. The product's core defensibility lies in the intersection of these two workflows: as more companies post on SmartHire and more candidates upload their profiles, the AI recommendation engine becomes more accurate, the pool of pre-screened candidates improves, and the platform becomes progressively harder to replicate with a spreadsheet or a generic job board. |

**Core differentiators:**
- AI job recommendations for candidates
- Structured ATS pipeline for recruiters
- Automated candidate communication
- Real-time hiring dashboard for admins