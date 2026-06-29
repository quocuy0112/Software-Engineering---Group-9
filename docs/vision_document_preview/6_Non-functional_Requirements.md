# 6. Non-Functional Requirements

**Author:** Nguyễn Minh Khôi   
**Student ID:** 24127066   
**Reviewer:** Nguyễn Gia Quốc Uy

---

## 6.1. Overview

The following non-functional requirements define the quality attributes, operational constraints, and engineering standards of the SmartHire Recruitment Platform. Unlike functional requirements, these requirements describe how well the system performs rather than what it does.

These requirements apply across all major functional modules, including authentication, candidate profile management, AI-powered CV analysis, job posting management, recruitment pipelines, notifications, analytics, and administrative functions.


## 6.2. Performance Requirements

The platform shall provide responsive interactions for all supported users while maintaining stable performance under normal operating conditions.

| Requirement | Target |
|------------|--------|
| Page loading time | ≤ 3 seconds under normal network conditions |
| Dashboard navigation | ≤ 2 seconds |
| Search response | ≤ 2 seconds for job searching and filtering |
| Authentication | Login/Register completed within 3 seconds |
| Candidate profile update | Saved within 2 seconds |
| Kanban drag-and-drop update | Visual response within 500 ms |
| Notification delivery | In-app notification appears within 5 seconds after triggering event |
| Export CSV/Excel | Complete within 10 seconds for datasets up to 10,000 records |
| AI semantic scoring | Complete within 20 seconds depending on CV size and AI provider |

The system shall support concurrent access from multiple users without significant degradation in response time.


## 6.3. Scalability Requirements

The architecture shall support future growth without requiring major redesign.

The system shall:

- support thousands of registered users.
- support hundreds of simultaneous active users.
- support multiple recruiters managing independent recruitment campaigns simultaneously.
- allow horizontal scaling of frontend and backend services.
- allow database scaling through indexing and optimization.
- support migration to cloud deployment if required.

The AI service shall be modular so that either:

- OpenAI API, or
- a custom local AI model

can be integrated without changing the business logic.


## 6.4. Availability and Reliability

The SmartHire platform shall provide reliable operation for both recruiters and candidates.

### Availability

- Target uptime: **99.5%**
- Planned maintenance shall be announced beforehand.
- System recovery after deployment failure shall be possible using rollback procedures.

### Reliability

The system shall:

- prevent data corruption during unexpected failures.
- preserve uploaded CV files.
- ensure recruitment pipeline states remain consistent.
- prevent duplicate applications caused by accidental refreshes.
- use transactional database operations for critical updates.


## 6.5. Security Requirements

Security is one of the highest priorities because the platform stores sensitive personal and business information.

## Authentication

The system shall:

- require authenticated login before accessing protected resources.
- issue stateless JSON Web Tokens (JWT).
- securely invalidate user sessions after logout.
- enforce password reset through email verification.
- store authenticatin tokens using HttpOnly, Secure, SameSite cookies, never in localStorage or sessionStorage, to prevent token theft via client-side scripts injection (XSS)

## Authorization

Role-Based Access Control (RBAC) shall ensure that:

- Candidates access only candidate functions.
- Recruiters access only recruitment management functions.
- Administrators access moderation and management features.

Unauthorized API requests shall return appropriate HTTP error responses.


## Password Security

Passwords shall:

- never be stored in plain text.
- be hashed using secure industry-standard hashing algorithms.
- satisfy minimum password complexity requirements.

## Data Protection

The system shall:

- encrypt sensitive communication using HTTPS.
- protect against common web vulnerabilities including:

  - SQL Injection
  - Cross-Site Scripting (XSS)
  - Cross-Site Request Forgery (CSRF)
  - Broken Authentication

- validate all user inputs before database processing.
- sanitize uploaded file names.


## 6.6. AI Service Requirements

The AI components shall function as decision-support tools rather than autonomous decision makers.

The platform shall:

- generate AI recommendations without automatically rejecting candidates.
- allow recruiters to override AI recommendations at any time.
- display generated AI scores together with human-readable explanations.
- continue operating when AI services are temporarily unavailable by falling back to rule-based matching where applicable.


## 6.7. Usability Requirements

The platform shall provide an intuitive user experience for all user roles.

The interface shall:

- follow consistent navigation patterns.
- minimize the number of steps required to complete common tasks.
- provide responsive layouts for desktop, tablet, and mobile devices.
- clearly indicate loading, success, and error states.
- display meaningful validation messages.
- support drag-and-drop interactions for Kanban recruitment management.
- provide searchable and filterable tables.
- minimize recruiter training time.

The application shall support modern accessibility principles including:

- readable typography
- sufficient color contrast
- keyboard accessibility
- descriptive labels
- responsive layouts


## 6.8. Compatibility Requirements

The platform shall operate correctly on major modern browsers including:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox
- Safari

The frontend shall support:

- Desktop computers
- Tablets
- Mobile devices

Supported resume formats include:

- PDF (.pdf)
- Microsoft Word (.docx)

Supported export formats include:

- CSV
- Microsoft Excel (.xlsx)


## 6.9. Maintainability Requirements

The software shall be designed for long-term maintenance.

The implementation shall:

- follow modular architecture.
- separate frontend and backend services.
- use layered backend architecture.
- maintain reusable UI components.
- follow TypeScript coding standards.
- use Git for version control.
- support continuous feature expansion.

Business logic, database access, and presentation logic shall remain loosely coupled.


## 6.10. Database Requirements

The database shall:

- maintain ACID transactional consistency.
- enforce referential integrity.
- automatically generate unique identifiers.
- prevent duplicate critical records.
- support indexing for high-frequency search operations.
- maintain audit information for important administrative actions.

Regular backup procedures shall be supported.


## 6.11. File Storage Requirements

The system shall support secure document management.

Resume uploads shall satisfy the following constraints:

| Item | Requirement |
|------|-------------|
| Supported formats | PDF, DOCX |
| Maximum file size | 5 MB |
| Duplicate protection | Supported |
| Virus checking | Recommended before storage |
| Secure storage | Required |

Deleted files shall no longer be publicly accessible.


## 6.12. Notification Requirements

The notification subsystem shall:

- automatically trigger notifications based on recruitment events.
- send interview invitations promptly.
- notify candidates when application status changes.
- support configurable email templates.
- prevent duplicate notification delivery.

Temporary email service failures shall not interrupt other platform operations.


## 6.13. Logging and Monitoring

The logging requirements below describe back-end level audit logging required for security and debugging purposes. They are independent of the admin-facing "activity log" dashboard feature (Group 12 in 5_Product_Features), which remains optional per team's PA2 prioritization.

The platform shall maintain system logs for:

- user authentication
- administrator actions
- recruiter moderation actions
- job posting approvals
- account suspension
- AI processing failures
- export activities
- critical system errors

Logs shall support troubleshooting and security auditing.


## 6.14. Legal and Compliance Requirements

The platform shall comply with applicable legal and ethical standards.

These include:

- Vietnamese Personal Data Protection Decree (Decree 13/2023/ND-CP)
- secure handling of personal information
- recruiter identity verification
- protection of uploaded resumes
- user consent for personal data processing

AI-generated recommendations shall remain advisory only and shall not replace human recruitment decisions.


## 6.15. Environmental and Platform Constraints

The system is designed as a modern web application using the following technology stack.

| Layer | Technology |
|---------|------------|
| Frontend | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | Shadcn UI |
| State Management | Zustand |
| Drag & Drop | hello-pangea/dnd |
| Backend | Next.js API Routes |
| Database | PostgreSQL / MySQL |
| Authentication | JWT |
| AI Integration | OpenAI API or Local AI Model |
| Version Control | GitHub |

The platform requires:

- Internet connectivity
- Modern web browser
- JavaScript enabled
- Email service for verification and notifications


## 6.16. Documentation Requirements

The project shall provide the following documentation:

- User Manual
- Recruiter User Guide
- Administrator Guide
- Installation Guide
- Deployment Guide
- API Documentation
- Database Schema Documentation
- System Architecture Documentation

Developer documentation shall be maintained alongside the source code.


## 6.17. Priority of Non-Functional Requirements

| Requirement Category | Priority | Rationale |
|----------------------|----------|-----------|
| Security | Critical | Protect sensitive user and company data |
| Reliability | Critical | Ensure recruitment data integrity |
| Performance | High | Maintain responsive user experience |
| Availability | High | Continuous platform accessibility |
| Scalability | High | Support future user growth |
| Usability | High | Improve recruiter and candidate efficiency |
| AI Reliability | High | Ensure trustworthy AI-assisted recommendations |
| Maintainability | Medium | Simplify future development |
| Compatibility | Medium | Support multiple browsers and devices |
| Documentation | Medium | Improve maintainability and onboarding |


## 6.18. Summary

The SmartHire Recruitment Platform prioritizes security, reliability, usability, and scalability while providing AI-assisted recruitment capabilities. These non-functional requirements ensure that all functional modules operate consistently, securely, and efficiently under real-world usage, while supporting future system growth and long-term maintainability.