# 5. Product Features

**Author:** Nguyễn Gia Quốc Uy   
**Student ID:** 24127261   
**Reviewer:** Group 9

## 5.1. Feature Overview
The table below summarizes the high-level feature groups of the SmartHire system. Each feature group represents a broader capability that may include multiple sub-features, which are described in more detail in the following section.

## 5.2. Detailed Feature List
| No | Group Feature | Short Description | Priority |
|---|---|---|---|
|1| **Authentication, Authorization & Access Control**| Allows candidates and employers to register and log in securely (with email verification and password recovery), and applies role-based access control RBAC to protect personal and business data.| High (P0) |
|2| **Account Setup & Management** | Allows users to update basic personal/company account information and change their password. | Medium (P1) | 
|3| **Candidate Profile Management** | Allows candidates to build their professional profile via a provided form or by uploading a CV, with a CV Parser that automatically standardizes the data for job applications and scoring. | High (P0) |
|4| **Job Board & Advanced Search** | Allows candidates to search, filter, view details of, and apply to approved job postings, along with saving, sharing, and reporting listings. | High (P0) | 
|5| **Job Posting Management** | Allows employers to create, preview, edit, and manage the lifecycle of job postings.| High (P0) |    
|6| **Application Tracking (Candidate Side)** | Allow candidates to track saved jobs, applied jobs (with a processing status) and recommended matching jobs| High (P0) | 
|7| **Candidate Screening & Hybrid Scoring System** | Automatically matches skills and analyzes CVs using AI-powered matching algorithm to score and rank candidates for each job posting | High (P0) | 
|8| **Recruitment Pipeline Kanban Board** | A drag-and-drop interface that lets employers track and update candidate status across recruitment stages. | High (P0) | 
|9| **Automated Notifications & In-App Alerts** | System will send email and real-time notifications to candidates/employers when application status changes.| Medium (P1) | 
|10| **Job Posting Moderation & Quality Assurance** | Allows admins to approve or reject new job postings and handle spam/violation reports. | High (P0) | 
|11| **User Management & Employer Verification** | Allows admins to look up user accounts, verify business licenses and handle violations| Medium (P1) | 
|12| **Recruitment Analytics & Data Export** | Provide dashboards, statistical reports on recruitment activity and exports candidate data to Excel/CSV| Medium (P1) | 

## 5.3 Feature Descriptions

### 5.3.1 Authentication, Authorization & Access Control
This feature group handles the entire process of registration, login, and role-based access control across the system. Users are split into two distinct roles which are candidates and employers. Users are separated into different access levels, including candidates, employers, and admins. Candidates use the system to manage profiles and apply for jobs, employers use it to post jobs and manage applicants, while admins supervise platform quality and user verification. By enforcing strict access control between these roles, the system helps protect candidates' personal data as well as sensitive internal information belonging to hiring companies.

### 5.3.2 Account Setup & Management
This feature allows candidates and employers to manage their basic account information, such as contact details, profile image, company information, and password settings. Although some profile fields may be optional, keeping account information updated helps both sides communicate more reliably and build trust during the recruitment process. Candidates benefit by presenting themselves more professionally, while employers benefit by making their company identity clearer to potential applicants.

### 5.3.3 Candidate Profile Management
This feature lets candidates build and digitize their profile directly on the platform, either by filling out a built-in form or by uploading their own CV file. Having this information stored in a structured format means candidates can apply to multiple jobs quickly, without retyping the same details over and over. On top of that, the system includes a CV Parser that automatically extracts text from uploaded PDF or DOCX files, which then feeds into the matching and scoring system later on.

### 5.3.4 Job Board & Advanced Search
This feature provides a public space where candidates can freely browse and search for job opportunities posted on the platform. With flexible advanced filters, candidates can quickly narrow down results by salary, years of experience, location, or job type to match what they're actually looking for. Overall, this feature bridges the gap between candidates and employers faster, saving job seekers time and improving their chances of finding the right job.

### 5.3.5 Job Posting Management
This feature gives employers the tools to create, preview, edit, and manage the entire lifecycle of their job postings. While drafting a job description, employers define structured data such as required skills, experience, salary range, and other key details. This not only gives employers full control over what they post, but also lays the groundwork the system later relies on to automatically filter and screen incoming applications.

### 5.3.6 Application Tracking (Candidate Side)
This feature lets candidates keep track of jobs they've saved, jobs they've applied to, and jobs the system recommends as a good match for them. For each application, candidates can see exactly where things stand, from “received” and “viewed” all the way through to “shortlisted” or “rejected”, without needing to contact the company directly to ask. Altogether, this gives candidates a single place to follow up on opportunities they care about, making it easier to stay organized while job hunting.

### 5.3.7 Candidate Screening & Hybrid Scoring System
This is essentially the recruitment "control center" that automatically classifies and evaluates candidate applications for each job posting. It works through a hybrid approach that combines rule-based skill/experience matching with AI-powered CV analysis. The biggest benefit here is freeing employers from manually screening hundreds of CVs a day, instead, they can focus their attention on the most promising candidates, ranked by a clear, visual compatibility score out of 100.

### 5.3.8 Recruitment Pipeline Kanban Board
This feature provides a visual board that lets employers track a candidate's entire journey through the different stages of the hiring process. By simply dragging and dropping a candidate's card between columns, employers can instantly update that candidate's status in the database. This gives the hiring team a clear, at-a-glance view of how a recruitment campaign is progressing and makes it much easier for team members to coordinate with one another.

### 5.3.9 Automated Notifications & In-App Alerts
This feature keeps candidates and employers in sync throughout the hiring process, without either side having to manually check for updates. Whenever an employer changes a candidate's status (via the Kanban board or other means), the candidate automatically receives a detailed email along with a real-time in-app alert. This keeps everyone informed right away and makes the overall experience feel a lot smoother.

### 5.3.10 Job Posting Moderation & Quality Assurance
This feature is built specifically for Admins to maintain content quality and prevent fraudulent or spammy job postings from flooding the platform. Every new job posting goes into a review queue first, and only becomes visible on the public job board once an Admin approves it. This keeps the recruitment environment trustworthy and protects candidates from scam job listings.

### 5.3.11 User Management & Employer Verification
This feature gives Admins the tools to keep the platform's user community healthy and trustworthy. Admins can search through the full list of candidate and employer accounts to provide support or take action against violations whenever necessary. A key part of this is verifying each employer's business license, which ensures that only legitimate companies are allowed to post jobs on the platform.

### 5.3.12 Recruitment Analytics & Data Export
This feature group provides statistical reports and data export tools that help both Admins and employers work more efficiently. Employers can gauge how appealing their job postings are by looking at view counts and successful hire rates, while Admins get a broader picture of the platform's overall growth through visual charts and dashboards. On top of that, users can export structured data to CSV or Excel files, making it easy to keep offline records or put together internal company reports.


## 5.4. Key User Workflows
