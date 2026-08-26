# SmartHire PA5 – Hướng dẫn đồng bộ tài liệu cuối kỳ

## Mục tiêu

Cập nhật toàn bộ Vision Document, Use-Case Model và Use-Case Specifications (PA3), Architecture/Diagrams (PA4), và Project Plan để phản ánh **đúng phiên bản SmartHire cuối cùng**.

Nguồn đối chiếu bắt buộc:

1. SpecKit từ Feature 001 đến Feature 026.
2. Source code, database schema, API routes, UI và automated tests hiện có.
3. Chức năng có thể chạy được trong môi trường demo.
4. Phạm vi cuối cùng mà nhóm chấp nhận demo và nộp PA5.

Tất cả tài liệu nộp phải viết bằng tiếng Anh, dùng Markdown; diagram dùng Mermaid; mỗi section phải có dòng attribution ngay dưới tiêu đề:

```md
*Performed by: [Name] | Reviewed by: [Name] | Edited by: [Name]*
```

## Nguyên tắc nguồn sự thật

Mỗi yêu cầu/chức năng chỉ được ghi là `Implemented` khi có đủ:

- UI hoặc cách người dùng thực hiện chức năng;
- API/business logic;
- dữ liệu được lưu hoặc xử lý thực tế;
- bằng chứng test hoặc demo;
- quyền truy cập đúng theo role.

Nếu chỉ có SpecKit, prototype hoặc test chưa chạy, dùng một trong các trạng thái sau:

- `Implemented and verified`
- `Implemented; verification pending`
- `In progress`
- `Specified but deferred from final release`
- `Out of final scope`

Không dùng các từ mơ hồ như “done”, “available”, “supports” nếu chưa chỉ rõ bằng chứng.

## Phân nhóm 26 SpecKit features

| Nhóm                                    | SpecKit                                | Nội dung cần phản ánh                                                                                                                 |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Identity, candidate profile, CV         | 001–005                                | Đăng ký, xác minh email, login, recovery, 2FA, profile, CV upload/parse/review, OCR, image-assisted search, job discovery/application |
| Home và candidate engagement            | 010, 011                               | Landing/home page, professional connection proposals                                                                                  |
| Recruiter workflow và tuyển dụng        | 007, 012, 015, 020–022                 | Recruiter base role, candidate filtering, hybrid scoring, application tracking/private CV match, Kanban pipeline, analytics/export    |
| Admin, moderation và company governance | 006, 009, 014, 017, 018, 023, 024, 026 | Platform admin, account/company verification, job-post review/management, company dashboard/member management, database backup        |
| Messaging và notifications              | 008, 013, 016, 019, 025                | Realtime messaging, report review, notifications/email, deep links, application-scoped recruitment messaging                          |

Trước khi sửa tài liệu, lập một bảng `Feature Inventory` có các cột:

| ID | Feature name | User roles | UI path | API/service | Database entities | Tests/evidence | Final status | Owner | Notes |
| -- | ------------ | ---------- | ------- | ----------- | ----------------- | -------------- | ------------ | ----- | ----- |

Bảng này là nguồn chung để tránh Vision, use case, diagram và Project Plan mô tả khác nhau.

## 1. Cập nhật Vision Document

Vision Document phải mô tả sản phẩm ở mức nghiệp vụ, không biến thành tài liệu kỹ thuật hoặc liệt kê endpoint.

Cần cập nhật:

1. Product overview: SmartHire là nền tảng tuyển dụng cho Candidate, Recruiter, HR Manager, Company Owner và Platform Administrator.
2. Stakeholders và actor roles: phân biệt rõ `Company Member` với `Platform Administrator`; quyền recruiter phải theo company scope.
3. Product features: gom theo năm nhóm ở trên, ghi business value, beneficiary và final release status.
4. Functional requirements: mỗi FR phải có mã ổn định, tên rõ ràng và link được đến ít nhất một use case và một SpecKit feature.
5. Non-functional requirements: RBAC/tenant isolation, privacy CV, auditability, accessibility, responsive UI, reliability, error/retry, performance và AI transparency.
6. Scope boundaries: ghi rõ những gì không có trong bản cuối, ví dụ restore database UI, chat nhóm, message attachment, AI tự ra quyết định tuyển dụng, hoặc tính năng P1 chưa đủ bằng chứng.
7. AI constraints: AI scoring chỉ advisory; không tự động tuyển/chọn ứng viên; consent, fallback và bảo vệ dữ liệu phải được ghi rõ.
8. Dependencies: PostgreSQL, email adapter, OCR engine, malware scanner, OpenAI API nếu dùng, Google Drive nếu backup được triển khai.

Mỗi feature trong Vision phải có bảng traceability tối thiểu:

| Vision FR | Feature ID | Use Case ID | UI/API evidence | Test case ID | Final status |
| --------- | ---------- | ----------- | --------------- | ------------ | ------------ |

## 2. Cập nhật Use-Case Model và Use-Case Specifications

Bộ hiện tại chỉ có 5 diagram, trong khi các feature sau PA4 đã mở rộng đáng kể. Không nên nhồi tất cả 26 features vào một diagram.

Đề xuất cấu trúc diagram cuối:

| Diagram | Nội dung                                                                       |
| ------- | ------------------------------------------------------------------------------ |
| DGM-01  | Identity, access, account, candidate profile và CV                             |
| DGM-02  | Candidate job discovery, image search, apply, saved jobs, application tracking |
| DGM-03  | Recruiter job posting, applicant review/scoring, pipeline Kanban               |
| DGM-04  | Company administration, membership, verification, moderation                   |
| DGM-05  | Notifications, professional connections, messaging và report review            |
| DGM-06  | Analytics/export và Platform Administration                                    |
| DGM-07  | Admin backup nếu tính năng này nằm trong final scope                           |

Với từng use case, bắt buộc cập nhật đầy đủ:

- Use-case ID và name;
- actor chính/phụ;
- description;
- preconditions;
- basic flow theo từng bước;
- toàn bộ alternative/error flows thực tế;
- postconditions;
- special requirements: authorization, privacy, audit, idempotency, accessibility, async/retry nếu có;
- related use cases;
- prototype hoặc screenshot UI thật tương ứng.

Các use case mới/được mở rộng cần kiểm tra đặc biệt:

- application-scoped recruitment messaging: Candidate, Recruiter/HR Manager, Owner read-only;
- notification center và deep-link authorization;
- company overview, membership/role/lifecycle;
- Kanban pipeline và stage-history;
- analytics/export theo company/admin scope;
- admin backup: recent 2FA, schedule, manual backup, history, failed run; **không mô tả restore UI nếu hệ thống không có**;
- hybrid scoring: giải thích score, override của recruiter, failure/retry; không mô tả AI như người ra quyết định.

Quy tắc diagram:

- Chỉ dùng `«include»` khi hành vi bắt buộc và tái sử dụng.
- Chỉ dùng `«extend»` cho luồng có điều kiện rõ ràng.
- Actor generalization phải đi từ actor chuyên biệt đến actor tổng quát.
- Mermaid source trong file `.md` là nguồn chính; PNG chỉ là bản render.
- Mọi UC có trong diagram phải có specification; mọi functional requirement trong Vision phải xuất hiện trong ít nhất một UC.

## 3. Cập nhật PA4 Architecture và Deployment Diagrams

Các diagram PA4 phải phản ánh source code cuối, không phản ánh kế hoạch cũ.

Cập nhật Technology Stack, C4 Level 1, C4 Level 2, Frontend Component, Backend Component và Deployment Diagram theo feature inventory.

Cần kiểm tra có/không các thành phần sau trước khi đưa vào diagram:

- Next.js web application;
- PostgreSQL;
- email worker/outbox;
- CV worker;
- image-search worker;
- OCR engine;
- malware scanner;
- OpenAI Responses API nếu thực sự được bật;
- Google Drive adapter cho backup nếu được triển khai;
- admin worker và backup process;
- external email service hoặc local capture adapter.

Mỗi container/node phải có:

| Thành phần | Responsibility | Technology | Communicates with | Protocol | Evidence |
| ---------- | -------------- | ---------- | ----------------- | -------- | -------- |

Không được vẽ AWS, S3, Redis, queue, WebSocket, Google Drive, AI API hoặc cloud deployment nếu source/deployment hiện tại không dùng chúng. Nếu adapter có trong code nhưng hạ tầng chưa provision, ghi đúng là `optional/not provisioned in final demo environment`.

## 4. Cập nhật Project Plan

Project Plan cần sửa khi status, scope, owner, timeline hoặc deliverable đã khác với kế hoạch cũ.

Cần bổ sung/cập nhật:

- Sprint 5 task list theo công việc thật đã làm;
- owner, reviewer, editor của từng task;
- status dựa trên evidence;
- final feature inventory 001–026;
- task đồng bộ PA1–PA5;
- test plan, test execution, bug reports, demo rehearsal, reflective report và packaging;
- rủi ro còn mở và mitigation;
- feature bị deferred/out of scope;
- final build exit criteria.

Không ghi một Sprint/Build là `Completed` nếu còn test, demo, bug report, document review hoặc package audit chưa xong.

## 5. Revision history và Changes.md

Tạo một file mới:

```text
docs/changes/changes_for_pa5/Changes.md
```

File này phải có section riêng cho từng tài liệu:

```md
# PA5 Changes

## Vision Document
## Use-Case Model
## Use-Case Specifications
## Technology Stack
## C4 Level 1 – System Context
## C4 Level 2 – Container
## C4 Level 3 – Frontend Components
## C4 Level 3 – Backend Components
## Deployment Diagram
## Project Plan
## Test Documents
```

Dùng bảng revision cụ thể, không ghi chung chung “updated documents”:

| Revision | Date       | Document/Section        | Exact change                                                                  | SpecKit IDs | Code/Test evidence                          | Reason                                            | Performed by | Reviewed by | Edited by |
| -------- | ---------- | ----------------------- | ----------------------------------------------------------------------------- | ----------- | ------------------------------------------- | ------------------------------------------------- | ------------ | ----------- | --------- |
| PA5-R01  | YYYY-MM-DD | Use-Case Model / DGM-05 | Added application-scoped recruitment messaging and Owner read-only oversight. | 025         | UI route, API authorization tests, E2E test | PA3 model did not cover final messaging workflow. | Name         | Name        | Name      |

Mỗi document cũng nên có bảng `Revision History` ngắn ở cuối. `Changes.md` là nhật ký thay đổi tổng hợp; revision history trong document là lịch sử riêng của document đó.

## 6. Quy trình review bắt buộc

1. Owner sửa document dựa trên Feature Inventory.
2. Reviewer đối chiếu với SpecKit, UI, API, database và test.
3. Editor chuẩn hóa English, thuật ngữ, IDs, Markdown và Mermaid.
4. Một người độc lập chạy checklist consistency.
5. Render lại PDF và kiểm tra link, ảnh prototype, Mermaid, heading, table và page break.
6. Chỉ sau đó mới cập nhật revision history và `Changes.md`.

## 7. Checklist chốt trước khi nộp

- [ ] Vision FR ↔ Use Case ↔ SpecKit ↔ UI/API/Test đều trace được.
- [ ] Mọi feature final scope đều có trạng thái trung thực.
- [ ] Không có feature “implemented” nhưng không có UI/API/database evidence.
- [ ] Không có component vẽ trong architecture nhưng không tồn tại trong source/deployment.
- [ ] Role permissions nhất quán: Candidate, Recruiter, HR Manager, Company Owner, Platform Administrator.
- [ ] Tenant/company isolation được mô tả nhất quán trong use case, test và architecture.
- [ ] Các luồng AI có consent, fallback và human override.
- [ ] PA3 use case diagrams là Mermaid và có specification/prototype evidence.
- [ ] PA4 C4 và deployment diagrams là Mermaid, đúng implementation cuối.
- [ ] Project Plan có status, owner, reviewer, timeline và acceptance criteria thực tế.
- [ ] `Changes.md` PA5 có thay đổi cụ thể cho từng document.
- [ ] Markdown và PDF đồng bộ.
- [ ] Toàn bộ tài liệu dùng English rõ ràng và attribution ở mọi section.
