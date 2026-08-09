# Rà soát tổng thể SmartHire đối chiếu Vision Document và đề xuất UI/UX

## Kết luận tổng quan

SmartHire hiện là một nền tảng Candidate khá hoàn chỉnh và có kiến trúc kỹ thuật tốt, nhưng chưa phải một ATS end-to-end đúng như Vision Document mô tả. Phần ứng viên, bảo mật tài khoản, hồ sơ, tìm việc, ứng tuyển và CV/OCR đã đi khá xa; trong khi ba trụ cột làm nên khác biệt của Vision — Recruiter workspace, Admin moderation và hybrid candidate scoring — phần lớn chưa có giao diện hoặc chưa được triển khai thực chất.

Báo cáo này được lập sau khi đọc đủ 43 trang của [Vision Document](./vision%20document/vision_document.pdf), kiểm tra code, 33 page routes, 53 API routes, 56 Prisma models, 296 file kiểm thử, CSS, cấu hình vận hành và các bằng chứng Spec Kit.

Ước lượng mức trưởng thành hiện tại, mang tính đánh giá sản phẩm chứ không phải test chính thức:

| Khía cạnh | Mức hiện tại |
|---|---:|
| Kiến trúc và phân lớp | 8/10 |
| Bảo mật và quyền riêng tư | 8/10 ở thiết kế/code; 4/10 ở bằng chứng production |
| Candidate experience | 7/10 |
| Recruiter experience | 2/10 |
| Administrator experience | 1/10 |
| Hybrid scoring theo Vision | 1/10 |
| Tính nhất quán UI/design system | 6/10 |
| Accessibility tự động | 7/10 |
| Usability đã kiểm chứng với người thật | 1/10 |
| Mức bao phủ tổng thể Vision | Khoảng 50–60% |

## 1. Hệ thống hiện có gì?

Kiến trúc hiện tại là modular monolith Next.js, bổ sung các worker tách biệt:

```text
Browser
  ├─ Next.js App Router
  ├─ Candidate/Auth/Profile/Jobs UI
  └─ REST route handlers
          ↓
Application services
          ↓
Repositories / providers
          ↓
PostgreSQL + private encrypted storage
          ├─ Email worker
          ├─ CV worker + ClamAV
          ├─ Image-search worker
          └─ OCR sidecar không có network
```

Thiết kế OCR hiện hành được mô tả khá kỹ trong [Feature 005 plan](../spec-kit/specs/005-ocr-parsing/plan.md).

Điểm mạnh kỹ thuật đáng ghi nhận:

- Route handler tương đối mỏng, business logic nằm trong service/repository.
- Better Auth quản lý session có lưu DB, giới hạn thời gian, revoke session, 2FA và backup code.
- PostgreSQL có transaction, unique constraint, index tìm kiếm, optimistic version và audit event.
- CV có malware scan, private encrypted storage, retention, consent, retry, idempotency và provenance.
- OCR chạy trong sidecar không có network, read-only, drop capabilities.
- Image search tách storage/key/worker khỏi CV.
- Có CSP, no-store, HSTS production, CSRF/origin protection và rate limit.
- Test suite rộng: 186 backend, 59 frontend, 29 E2E, cùng các test security, architecture và performance.
- Design token, dark mode, focus-visible, reduced-motion và responsive 320px đã được đặt nền móng trong [`tokens.css`](../web/src/frontend/styles/tokens.css) và [`responsive.css`](../web/src/frontend/styles/responsive.css).

## 2. Đối chiếu 12 nhóm tính năng của Vision

| Nhóm trong Vision | Hiện trạng | Nhận định |
|---|---|---|
| 1. Authentication, Authorization & Access Control | Phần Candidate rất mạnh; Better Auth, email verification, recovery, 2FA, sessions. Company membership mới chủ yếu ở schema và một API đổi application stage. | Đạt tốt cho Candidate; chưa đạt multi-role product experience. |
| 2. Account Setup & Management | Có identity, email change, avatar, password, preferences, sessions, security. | Gần hoàn chỉnh dù Vision xếp phần lớn là P1. |
| 3. Candidate Profile Management | Có basics, skills, experience, education, social links, avatar, CV library, CV parsing/OCR và review-before-save. | Một trong các phần tốt nhất hệ thống. |
| 4. Job Board & Advanced Search | Có public search, filter, sort, save, report, apply, related jobs, suggested jobs và image-assisted search. | Khá đầy đủ, nhưng release evidence và usability còn thiếu. |
| 5. Job Posting Management | Có model và dữ liệu seed; không có recruiter page hoặc CRUD/lifecycle API đầy đủ. | Chưa triển khai ở mức sản phẩm. |
| 6. Candidate Application Tracking | Có danh sách, nhóm trạng thái, timeline, chi tiết submission và 9 trạng thái đúng Vision. | Khá tốt. |
| 7. Candidate Screening & Hybrid Scoring | Có trường dữ liệu và UI consent, nhưng chưa có scoring pipeline thực. | Chưa đạt; có một vấn đề nghiêm trọng về điểm giả lập. |
| 8. Recruitment Pipeline Kanban | Có policy và API chuyển trạng thái transactionally; không có recruiter board, drag-and-drop hoặc accessible board alternative. | Chỉ có nền backend rất nhỏ. |
| 9. Notifications & In-App Alerts | Có email outbox và tạo `RecruitmentNotificationWork`; không có notification center/inbox trên UI. | Email partial; in-app chưa hoàn chỉnh. |
| 10. Job Moderation & QA | Candidate có thể report job; không có admin moderation queue, decision UI hoặc lifecycle đầy đủ. | Chưa triển khai. |
| 11. User Management & Employer Verification | Có `Company`, `CompanyMembership`; không có onboarding/verification/admin flows như Vision. | Chủ yếu mới là data model. |
| 12. Analytics & Export | Không có dashboard recruitment analytics hoặc CSV/XLSX export. | Chưa làm; chấp nhận được nếu giữ đúng P1. |

### Điểm lệch chiến lược lớn nhất

Feature 005 OCR/image search được đầu tư rất sâu, trong khi nhiều capability P0 cốt lõi của Recruiter/Admin vẫn chưa bắt đầu. Về kỹ thuật, OCR là phần thú vị; về sản phẩm, thứ tự ưu tiên này làm SmartHire giống “candidate job workspace có OCR” hơn là “ATS cho SME”.

Nên tạm ngừng mở rộng OCR/search intelligence sau khi ổn định release và chuyển trọng tâm sang vòng đời tuyển dụng phía doanh nghiệp.

## 3. Vấn đề nghiêm trọng cần xử lý trước khi mở rộng UI

### 3.1. Điểm AI 82% hiện là dữ liệu giả nhưng được trình bày như kết quả thật

Khi ứng viên đồng ý AI, repository lưu ngay `aiMatchScore = 82` và `scoringStatus = COMPLETED` tại [`prisma-job-application-repository.ts`](../web/src/backend/repositories/jobs/prisma-job-application-repository.ts). UI cũng bổ sung và hiển thị lại 82% tại [`apply-form-section.tsx`](../web/src/frontend/features/jobs/components/apply-form-section.tsx).

Đây là khoảng trống nguy hiểm nhất vì:

- Trái với Vision về hybrid scoring thực và human-readable explanation.
- Có thể làm người dùng tin rằng CV đã được phân tích.
- Làm sai dữ liệu ứng tuyển, analytics và đánh giá sản phẩm.
- Consent hiện dẫn tới một “kết quả” cố định thay vì một tác vụ xử lý thật.

Khuyến nghị tức thời: cho tới khi pipeline scoring thực tồn tại, không hiển thị phần trăm; chỉ thể hiện “AI analysis chưa khả dụng” hoặc bỏ hẳn tùy chọn consent khỏi luồng apply.

### 3.2. Global image search xuất hiện trên mọi route

`GlobalImageSearch` được mount ở root layout, trước toàn bộ page content tại [`layout.tsx`](../web/src/app/layout.tsx), và CSS đặt `position: fixed; top: 10px; z-index: 70` tại [`image-search.css`](../web/src/frontend/features/jobs/image-search/styles/image-search.css).

Hệ quả có khả năng xảy ra:

- Che hoặc cạnh tranh với header của login, registration, dashboard, profile và CV review.
- Tạo hai vùng điều hướng/search song song.
- Đưa chức năng nâng cao xuất hiện trước khi người dùng hiểu sản phẩm.
- Trên mobile, chiếm nhiều diện tích đầu màn hình và làm navigation hierarchy rối.

Nên chỉ đặt image search trong `/jobs`, hoặc mở bằng action trong search bar của Job Board.

### 3.3. Vision và code không còn cùng một technical baseline

Vision vẫn ghi JWT stateless, Zustand, Shadcn UI, `hello-pangea/dnd`, PostgreSQL/MySQL. Code thực tế dùng:

- Better Auth database-backed sessions và PostgreSQL tại [`config.ts`](../web/src/backend/auth/cookies/config.ts).
- React local state/TanStack Query; không có Zustand.
- UI primitives và CSS tự xây; không có Shadcn.
- Không có drag-and-drop library.
- PostgreSQL là database duy nhất.

Đây không nhất thiết là quyết định kỹ thuật xấu; Better Auth session hiện còn an toàn và thực tế hơn mô tả JWT. Vấn đề là tài liệu đang đưa ra baseline sai. [`README.md`](../README.md) cũng còn ghi Next 16.2.11 và “release tập trung IAM”, trong khi package dùng Next 16.3 và đã có Feature 005.

Nên chọn một nguồn sự thật: cập nhật Vision ở mức product, còn chi tiết stack đặt trong Architecture/ADR.

### 3.4. Scope file không nhất quán

Vision và CV import chỉ chấp nhận PDF/DOCX, nhưng direct application UI vẫn chấp nhận `.doc` và `application/msword` tại [`apply-form-section.tsx`](../web/src/frontend/features/jobs/components/apply-form-section.tsx).

Nên thống nhất một admission policy toàn hệ thống; không để “CV Library” và “CV dùng khi apply” có luật khác nhau.

## 4. Đánh giá UI/UX hiện tại

### Những điểm đang làm tốt

- Visual foundation khá sạch: xanh navy/blue, typography Be Vietnam Pro, card hierarchy, spacing và trạng thái semantic.
- Control height 40–56px phù hợp touch target.
- Dark mode dùng token chứ không override rời rạc.
- Có `aria-current`, `role=status/alert`, focus return, modal semantics và reduced motion.
- Candidate dashboard có profile completion và next steps rõ.
- Application tracking dùng timeline và giải thích “what happens next”, đúng nhu cầu transparency trong Vision.
- CV import có review-before-write, provenance, conflict và retention control — tốt hơn nhiều hệ thống job board thông thường.
- Image search giữ proposal editable/removable và không trực tiếp tìm/rank ứng viên.

### Những điểm cần cải thiện

#### Information architecture

- Navigation hiện hoàn toàn là Candidate: Dashboard, Jobs, Profile.
- Không có role/company switcher dù schema hỗ trợ người dùng thuộc nhiều công ty.
- “Jobs workspace” xuất hiện cả sidebar subnav và tab bar bên trong page, gây trùng điều hướng.
- Global search tạo thêm một lớp navigation thứ ba.
- Không có notification center, help, privacy hub hoặc recruiter entry point.

Đề xuất cấu trúc:

```text
Public
├─ Tìm việc
├─ Dành cho doanh nghiệp
├─ Cách hoạt động
├─ An toàn & quyền riêng tư
└─ Đăng nhập / Đăng ký

Candidate workspace
├─ Tổng quan
├─ Tìm việc
├─ Đã lưu
├─ Ứng tuyển
├─ Hồ sơ & CV
├─ Thông báo
└─ Cài đặt

Recruiter workspace
├─ Tổng quan công ty
├─ Tin tuyển dụng
├─ Ứng viên
├─ Pipeline
├─ Mẫu thông báo
└─ Thành viên công ty

Admin workspace
├─ Employer verification
├─ Job moderation
├─ Reports
├─ User enforcement
└─ Audit/operations
```

#### Landing page

Landing page đẹp nhưng định vị gần như chỉ cho ứng viên, trong khi Vision định vị sản phẩm là ATS cho SME.

Nên bổ sung:

- Hai CTA rõ: “Tìm việc” và “Tuyển dụng cho doanh nghiệp”.
- Demo ngắn của pipeline, scoring explanation và verified employers.
- Social proof/trust section.
- Giải thích “AI hỗ trợ, con người quyết định”.
- Liên kết Privacy, Terms, AI policy, Data deletion và Accessibility.
- Nội dung tiếng Việt mặc định hoặc lựa chọn ngôn ngữ ngay từ public shell.

#### Job search

Hiện có hai hướng thiết kế song song:

- `JobSearchForm` thực sự đang dùng.
- `FilterBar`/`JobBoardExperience` phong phú hơn nhưng không được route sử dụng.

Thêm vào đó, [`job-board.css`](../web/src/frontend/features/jobs/styles/job-board.css) dài hơn 7.000 dòng, có các selector legacy và redesigned lặp lại.

Nên:

- Chọn một implementation duy nhất.
- Desktop: search bar trên cùng, filter sidebar hoặc filter drawer.
- Mobile: filter button + bottom sheet, active-filter chips, số kết quả luôn thấy được.
- Cho phép multi-select thật với employment type/skills thay vì mỗi field chỉ chọn/nhập một giá trị.
- Format salary theo triệu VND; không để người dùng nhập `20000000` bằng tay.
- Có “Save search” và trạng thái update preferences rõ ràng.
- Loại bỏ filter/sort không được backend hỗ trợ thay vì mapping gần đúng.
- Giữ cursor pagination nhưng đổi CTA thành “Xem thêm 20 việc”, có loading feedback.

#### Job detail và Apply

Job detail đã nhiều nội dung, nhưng cần ưu tiên thứ tự:

1. Chức danh, công ty đã xác minh.
2. Lương, địa điểm, kiểu làm việc, deadline.
3. Requirements/skills.
4. Apply CTA.
5. Company information.
6. Related jobs.

Apply modal hiện gần 1.000 dòng logic trong một component và chứa nhiều tác vụ phụ: chọn CV, upload CV, sửa contact, cập nhật location, consent AI, screening question và submit. UX dễ trở thành “form trong form”.

Đề xuất tách thành stepper:

- Bước 1: Hồ sơ liên hệ.
- Bước 2: Chọn CV.
- Bước 3: Câu hỏi bổ sung.
- Bước 4: Consent và kiểm tra lại.
- Bước 5: Confirmation receipt.

Có autosave draft, step summary, lỗi tập trung ở đầu và luôn cho phép quay lại mà không mất dữ liệu.

#### Candidate application tracking

Phần này phù hợp Vision, nhưng nên bổ sung:

- Timeline theo ngôn ngữ tự nhiên, ví dụ “Nhà tuyển dụng đã xem hồ sơ”.
- Chỉ hiển thị stage mà recruiter cho phép ứng viên thấy.
- Mốc “lần cập nhật cuối” và kỳ vọng phản hồi.
- Hộp thư liên quan đến application.
- Withdraw application nếu business rule cho phép.
- Không hiển thị score nếu chưa có scoring pipeline và explanation thật.

#### Profile và CV import

Profile có nhiều chức năng nhưng bị phân mảnh thành nhiều form/save action.

Nên:

- Tạo profile overview dạng CV preview.
- Hiển thị completion theo mục tiêu cụ thể, không chỉ phần trăm heuristic.
- “Edit mode” và “Preview as recruiter”.
- Sticky save bar khi có thay đổi chưa lưu.
- Hợp nhất CV Library và CV Import thành một information architecture.
- Với CV import/OCR, dùng stepper rõ ràng: Upload → Scan → Extract → Review → Apply → Done.
- Mặc định chỉ mở các field cần attention; field high-confidence có thể collapse.
- Tóm tắt “sẽ ghi 6 mục, bỏ qua 3 mục” trước confirmation.
- Tách “xóa file nguồn”, “xóa draft”, “giữ CV trong library” thành wording dễ hiểu hơn retention terminology.

#### Image-assisted search

Đây là chức năng giàu trạng thái nhưng đang đặt quá nổi bật.

Nên:

- Tích hợp vào Job Search dưới nút “Tìm từ ảnh”.
- Cho preview ảnh cục bộ trước upload.
- Hiển thị ba bước: Đọc ảnh → Hiểu tiêu chí → Chờ bạn xác nhận.
- Không dùng confidence phần trăm; dùng “Tự động nhận diện” và “Cần kiểm tra”.
- Cho thấy rõ manual filter nào sẽ được giữ, thay thế hoặc hợp nhất.
- Sau apply, hiển thị summary: “Đã thêm 3 bộ lọc, giữ lại địa điểm hiện tại”.
- Có undo trong trang kết quả.
- Chỉ yêu cầu consent tại thời điểm thực sự gửi OCR text ra external provider.

## 5. UI cho Recruiter và Admin cần được thiết kế như thế nào?

### Recruiter MVP

Ưu tiên một luồng end-to-end nhỏ nhưng thật:

1. Request company membership.
2. Admin xác minh.
3. Recruiter tạo draft job bằng wizard.
4. Admin duyệt job.
5. Candidate apply.
6. Recruiter xem applicant list.
7. Recruiter chuyển stage.
8. Candidate nhận email/in-app update.

Recruiter dashboard nên có:

- Company switcher.
- Các job đang active.
- Application mới/chưa xem.
- Stage bottleneck.
- Việc cần làm hôm nay.
- Notification failures.
- Không đưa analytics phức tạp trước khi pipeline cơ bản ổn định.

Kanban cần có cả:

- Drag-and-drop trên desktop.
- Keyboard move action.
- Table/list view thay thế.
- Conflict feedback khi hai recruiter cập nhật cùng lúc.
- Undo ngắn hạn.
- Lý do bắt buộc cho Reject/Offer declined.
- Candidate-visible message preview.

Backend chuyển stage đã có transaction và company authorization tốt tại [`application-stage-service.ts`](../web/src/backend/services/jobs/application-stage-service.ts), nên đây là nền phù hợp để xây UI.

### Admin MVP

Nên dùng queue-based UX:

- Employer verification queue.
- Job moderation queue.
- Candidate job reports.
- Suspended users.
- Retry/dead-letter notifications.
- Audit lookup.

Mỗi decision panel cần:

- Evidence ở bên trái.
- Policy checklist ở giữa.
- Approve/Reject/Request revision ở bên phải.
- Lý do bắt buộc và candidate/recruiter-visible copy.
- History và actor.
- Không cho bulk-approve các trường hợp rủi ro cao.

## 6. Accessibility, i18n và trust

Automated accessibility khá tốt, nhưng báo cáo chính thức vẫn ghi “AUTOMATED PASS / LIVE MANUAL AUDIT PENDING” tại [accessibility results](../spec-kit/specs/002-candidate-profile-account-management/checklists/accessibility-results.md).

Cần hoàn thành:

- Keyboard walkthrough ở desktop và 320px.
- Screen reader announcement cho success/error/conflict.
- Focus order trong apply modal, image-search panel và CV review.
- 200% zoom và text spacing.
- High contrast/dark mode thực tế.
- Accessible Kanban alternative.
- Usability test với người dùng Việt Nam thật.

I18n hiện phân tán: sidebar/dashboard có Việt–Anh, còn phần lớn Jobs/Auth/Application dùng English cố định; root luôn `lang="en"`. Nên dùng một i18n layer thống nhất, đổi `html lang`, locale-aware date/currency và glossary tuyển dụng thống nhất.

Ngoài trang AI CV policy, cần một trust center với:

- Chính sách quyền riêng tư.
- Điều khoản sử dụng.
- Quyền truy cập/chỉnh sửa/xóa dữ liệu.
- Retention CV.
- External AI processing.
- Accessibility statement.
- Cơ chế báo cáo lừa đảo.

## 7. Chất lượng và trạng thái release thực tế

Kết quả kiểm tra hiện tại:

- `npm run typecheck`: PASS.
- `npm run lint`: FAIL với 2 lỗi và 1 warning.
  - Biến `changed` không được dùng tại [`job-interaction-provider.tsx`](../web/src/frontend/features/jobs/components/job-interaction-provider.tsx).
  - Company avatar dùng `<img>`, gây warning tối ưu ảnh.
- Không chạy full test/build vì nhiệm vụ rà soát ban đầu không chỉnh sửa code và các suite integration phụ thuộc hạ tầng.

Các release gate chưa hoàn tất:

- Feature 003 còn 5 task validation/release/usability.
- Feature 005 còn full regression, nghiên cứu 30 participant và final sign-off tại [Feature 005 tasks](../spec-kit/specs/005-ocr-parsing/tasks.md).
- CV import vẫn ghi P0 production blocked vì usability study có 0/30 participant tại [Feature 004 usability results](../spec-kit/specs/004-cv-upload-parse-review/checklists/usability-results.md).
- Không có GitHub Actions workflow thực tế dù Vision yêu cầu lint/typecheck/test trước merge.
- Không có production ingress, app deployment manifest, monitoring dashboard, backup/restore evidence hoặc disaster-recovery exercise.
- CSP chỉ cho ảnh từ `self`/`data`, trong khi fixture company logo dùng URL ngoài; logo sẽ fallback thành initials. Cần proxy/upload logo vào controlled storage thay vì nới CSP tùy tiện.

## 8. Lộ trình đề xuất

### P0 — Trung thực sản phẩm và hoàn thiện core loop

- Xóa/ẩn score 82% giả và AI-scoring claims chưa có thật.
- Di chuyển global image search về `/jobs`.
- Thống nhất PDF/DOCX policy.
- Hoàn thiện recruiter membership và company switcher.
- Job posting CRUD + lifecycle.
- Applicant list + stage management.
- Admin employer verification và job moderation.
- Notification center tối thiểu.
- Dọn lint, dead UI và documentation drift.
- Chạy release/usability gates còn thiếu.

### P1 — Hoàn thiện ATS differentiator

- Hybrid scoring pipeline thực với deterministic breakdown, AI semantic analysis và explanation.
- Recruiter Kanban + table fallback.
- Candidate-visible score chỉ sau khi có policy, provenance và explanation.
- Messaging/template management.
- Saved search và notification preferences.
- Centralized i18n Việt–Anh.
- Trust center và data-rights UX.

### P2 — Tối ưu và tăng trưởng

- Analytics, funnel, stage conversion.
- CSV/XLSX export theo tenant.
- Collaboration notes/evaluation.
- Employer branding.
- Search personalization có kiểm soát.
- Calendar integration sau khi core workflow ổn định.

## Khuyến nghị cuối cùng

Không nên tiếp tục thêm tính năng AI/OCR mới ở thời điểm này. Hướng đi tốt nhất là:

1. Làm sản phẩm trung thực bằng cách loại bỏ scoring giả.
2. Hoàn thành một recruitment loop end-to-end thật cho Candidate–Recruiter–Admin.
3. Chuẩn hóa navigation, i18n và design system.
4. Thực hiện usability study đã được định nghĩa.
5. Sau đó mới đưa hybrid scoring vào như một capability có giải thích, không phải một con số trang trí.

Nói ngắn gọn: nền kỹ thuật hiện tại tốt hơn mức độ hoàn thiện sản phẩm. Nếu chuyển trọng tâm từ “thêm chiều sâu Candidate/OCR” sang “khép kín ATS workflow”, SmartHire sẽ tiến gần Vision nhanh hơn rất nhiều.
