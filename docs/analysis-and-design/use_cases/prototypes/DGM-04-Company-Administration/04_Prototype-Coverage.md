# Prototype Coverage & Traceability – Diagram 4
## Company Management and Platform Administration

## 1. Diagram Scope

### Use Cases Included
| Use Case ID | Use Case Name |
|-------------|---------------|
| UC-ORG-01 | Submit Company Verification Request |
| UC-ORG-02 | Request to Join Existing Company |
| UC-ORG-03 | Review Company or Membership Request |
| UC-ORG-04 | Manage Company Memberships and Roles |
| UC-ORG-05 | Manage Membership Lifecycle |
| UC-USER-01 | Search and View User Accounts |
| UC-USER-02 | Apply Account Enforcement Action |
| UC-MOD-01 | Review Submitted Job Posting |
| UC-MOD-02 | Approve, Reject, or Request Revision |
| UC-MOD-03 | Investigate Job Report |

### Actors Included
| Actor | Type | Description |
|-------|------|-------------|
| **Authenticated User** | Base Actor | Any logged-in user with a verified account. |
| **Candidate** | Specialized Actor (inherits AU) | User applying for jobs. |
| **Company Member** | Specialized Actor (inherits AU) | User with a company membership. |
| **Platform Administrator** | Specialized Actor (inherits AU) | System admin for moderation, verification, and enforcement. |
| **Recruiter** | Specialized Actor (inherits CM) | Company member with recruitment permissions. |
| **HR Manager** | Specialized Actor (inherits CM) | Company member with elevated HR permissions. |
| **Company Owner** | Specialized Actor (inherits CM) | Company member with ownership and full management rights. |
| **File Parsing Service** | External System | Scans uploaded business license documents for malware. |

### Relationship Summary
- **Generalization**:  
  - `Authenticated User` → `Candidate`, `Company Member`, `Platform Administrator`  
  - `Company Member` → `Recruiter`, `HR Manager`, `Company Owner`
- **Extend**:  
  - `UC-USER-02` extends `UC-USER-01` (from account view to enforcement action)  
  - `UC-MOD-02` extends `UC-MOD-01` (from review to decision)

---

## 2. Coverage Matrix

*Note:*  
- **P0** = Must-have (core release)  
- **P1** = Should-have (after P0 stable)  
- **FR-01** = Authentication, Authorization & Access Control  
- **FR-09** = Automated Notifications & In-App Alerts  
- **FR-10** = Job Posting Moderation & Quality Assurance  
- **FR-11** = User Management & Employer Verification  

| Use Case ID | Use Case Name | Priority (Vision) | Covered Requirements | Prototype Evidence Exists? | UI Mockup References (from UseCases.md) |
|-------------|---------------|-------------------|----------------------|----------------------------|------------------------------------------|
| UC-ORG-01 | Submit Company Verification Request | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-ORG-01-UI_01.png, UI_02.png, UI_02a.png, UI_03.png, UI_03a.png, UI_04.png, UI_05.png |
| UC-ORG-02 | Request to Join Existing Company | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-ORG-02-UI_01.png, UI_02.png, UI_02a.png, UI_03.png, UI_03a.png |
| UC-ORG-03 | Review Company or Membership Request | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-ORG-03-UI_01.png, UI_02.png, UI_03.png, UI_03a.png, UI_03b.png |
| UC-ORG-04 | Manage Company Memberships and Roles | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-ORG-04-UI_01.png, UI_02.png, UI_02a.png, UI_02b.png |
| UC-ORG-05 | Manage Membership Lifecycle | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-ORG-05-UI_01.png, UI_02.png, UI_02a.png, UI_03.png, UI_03a.png, UI_04.png, UI_04a.png, UI_04b.png |
| UC-USER-01 | Search and View User Accounts | P0 (Must) | FR-01, FR-11 | ✅ Yes | UC-USER-01.png |
| UC-USER-02 | Apply Account Enforcement Action | P0 (Must) | FR-01, FR-09, FR-11 | ✅ Yes | UC-USER-02.png |
| UC-MOD-01 | Review Submitted Job Posting | P0 (Must) | FR-01, FR-10 | ✅ Yes | UC-MOD-01.png |
| UC-MOD-02 | Approve, Reject, or Request Revision | P0 (Must) | FR-01, FR-09, FR-10 | ✅ Yes | UC-MOD-02-UI_01.png, UI_02.png, UI_03.png, UI_04.png |
| UC-MOD-03 | Investigate Job Report | P0 (Must) | FR-01, FR-09, FR-10 | ✅ Yes | UC-MOD-03-UI_01.png, UI_02.png, UI_03.png, UI_04.png, UI_05.png |

---


