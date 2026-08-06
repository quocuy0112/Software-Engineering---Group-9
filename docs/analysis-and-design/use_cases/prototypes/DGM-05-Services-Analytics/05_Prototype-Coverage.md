# Prototype Coverage & Traceability - Diagram 5 (Supporting Services and Analytics)

*Performed by: Lưu Chí Hải | Reviewed by: Nguyễn Gia Quốc Uy | Edited by: Lưu Chí Hải*

This document maps the flows in the Use Case Specifications to their corresponding Prototype Evidence (screenshots), ensuring compliance with the project's Traceability Validation Rules.

> **Principle Note:**
> - 1 Use Case ≠ 1 unique screen. Base screens are reused across multiple Use Cases and alternative flows by changing minor states or components.
> - To enhance the evaluation and demonstration of this diagram, an interactive HTML prototype (`Hai-Prototype.html`) containing live states and role switching for all Diagram 5 use cases is included in the same folder as this file.

## Diagram 5 Scope: Supporting Services and Analytics

This section covers the 9 use cases categorized under the Supporting Services and Analytics domain:

| Use Case ID | Use Case Name |
| :--- | :--- |
| **UC-SCR-01** | Execute Hybrid Candidate Screening |
| **UC-SCR-02** | View Candidate Score and Explanation |
| **UC-SCR-04** | Retry Failed Scoring |
| **UC-NOT-01** | Receive Event Notification |
| **UC-NOT-02** | Manage In-App Notifications |
| **UC-NOT-03** | Retry Failed Notification Delivery |
| **UC-ANL-01** | View Company Recruitment Analytics |
| **UC-ANL-02** | View Platform Analytics |
| **UC-ANL-03** | Export Authorized Data |

---

## Coverage Matrix

| Use Case ID | Specification Flow | Prototype Evidence (Filename) | State / Reuse |
| :--- | :--- | :--- | :--- |
| **UC-SCR-01** | Basic Flow: System initiates scoring | `UI_01_Scanning_State.png` | Evaluation base screen + Loading spinner |
| **UC-SCR-01** | Basic Flow: Scoring completed successfully | `UI_01_Ready_State.png` | Evaluation base screen + Score 85/100 & Explanation |
| **UC-SCR-01** | Alternative Flow (AF): Scoring failed | `UI_01_Error_State.png` | Evaluation base screen + Red error message "System failed" |
| **UC-SCR-02** | Basic Flow: Recruiter views score & explanation | `UI_01_Ready_State.png` | (Reuse `UI_01_Ready_State.png` of UC-SCR-01) |
| **UC-SCR-02** | AF: Candidate pending score / Hide confidential data | `UI_02_Hidden_Score.png` | Application screen (Candidate view) + Hidden score card |
| **UC-SCR-04** | Basic Flow: View error details and select Retry | `UI_01_Error_State.png` | (Reuse `UI_01_Error_State.png`) + "Retry AI Scoring" button |
| **UC-SCR-04** | Basic Flow: Retry process in progress | `UI_01_Retry_Progress.png` | Scanning state + Toast notification "AI is retrying..." |
| **UC-NOT-01** | Basic Flow: Receive in-app alert notification | `UI_03_Dropdown_Alert.png` | Dropdown menu from the bell icon |
| **UC-NOT-01** | Basic Flow: Receive toast notification | `UI_03_Toast_Alert.png` | Toast notification at the bottom corner |
| **UC-NOT-02** | Basic Flow: View list and status (Read/Unread) | `UI_03_List_Unread.png` | Notifications tab base screen + Unread red dot |
| **UC-NOT-02** | AF: No notifications (Empty) | `UI_03_Empty_State.png` | Notifications base screen + Empty State icon "You're all caught up" |
| **UC-NOT-03** | Basic Flow / AF: Record error and auto-retry | `UI_05_Gauge_Fail_Rate.png` | "Notification Delivery Rate" card on Admin Dashboard |
| **UC-ANL-01** | Basic Flow: View company analytics | `UI_04_Company_Dashboard.png` | Company Analytics base screen + Donut/Funnel charts |
| **UC-ANL-01** | AF: Not enough data to display | `UI_04_No_Data.png` | Analytics base screen + "Not enough data" block |
| **UC-ANL-01** | AF: User lacks access permission | `UI_04_Unauthorized_State.png` | (Illustrated by disabled Export button) |
| **UC-ANL-02** | Basic Flow: View platform analytics | `UI_05_Admin_Dashboard.png` | Admin Dashboard base screen + Traffic/AI Success charts |
| **UC-ANL-02** | AF: System issue warning | `UI_05_Admin_Banner.png` | Admin Dashboard + Red banner "High failure rate detected" |
| **UC-ANL-03** | Basic Flow: Select data export format | `UI_04_Export_Menu.png` | Dashboard with data + Dropdown menu for CSV/PDF |
| **UC-ANL-03** | AF: Permission denied to export data | `UI_04_Export_Disabled.png` | (Reuse `UI_04_Unauthorized_State.png`) Disabled/locked button |
