# Tổng Quan Console Admin

Trên branch `006-admin-management`, trang `console.admin` đã xây dựng phần lớn
chức năng quản trị nền tảng bằng **React Admin 5**, chạy trong cùng ứng dụng
Next.js nhưng được cách ly bằng hostname:

- Candidate: `http://localhost:3001`
- Admin: `http://console.admin.localhost:3001`
- Recruiter entitlement: `http://console.recruiter.localhost:3001`

Các resource chính đã đăng ký gồm Accounts, Companies, Company Memberships,
Verification Requests và Moderation Reports. Generic CRUD như
`create/edit/delete` bị khóa; các thao tác nhạy cảm phải gọi command endpoint
riêng.

## Trạng Thái Hiện Tại

- `53` test files và `129` tests của Feature 006 đã pass khi chạy focused suite.
- Contract có `32` paths và `drift=false`.
- Admin worker probe pass.
- Có `135` tasks hoàn thành và `10` tasks release/E2E còn mở.
- Tính năng chưa sẵn sàng production release, chủ yếu vì E2E đầy đủ,
  performance thực tế, accessibility/usability thủ công và evidence-policy
  approval chưa hoàn tất.

## Các Trang Đã Build

| URL trên admin origin | Chức năng |
| --- | --- |
| `/` | Dashboard hoặc form đăng nhập nếu chưa xác thực |
| `/#/login` | Đăng nhập admin bằng email/password và TOTP |
| `/#/accounts` | Danh sách, tìm kiếm và lọc tài khoản |
| `/#/accounts/{id}/show` | Chi tiết bảo mật, sessions, memberships, notifications và audit |
| `/#/companies` | Danh sách Company dạng chỉ đọc |
| `/#/company-memberships` | Danh sách quyền thành viên theo Company |
| `/#/company-memberships/{id}/show` | Suspend, restore hoặc remove một membership |
| `/#/verification-requests` | Hàng đợi xét duyệt xác minh doanh nghiệp |
| `/#/verification-requests/{id}/show` | Xem evidence và approve/request changes/reject |
| `/#/moderation-reports` | Hàng đợi báo cáo vi phạm |
| `/#/moderation-reports/{id}/show` | Assignment, private note, resolve, dismiss và link enforcement |

### Dashboard

Dashboard hiển thị snapshot của:

- Candidate active, suspended và pending.
- Recruiter-enabled accounts.
- Active OWNER, HR_MANAGER, RECRUITER và HIRING_MANAGER memberships.
- Suspended memberships.
- Pending verification requests.
- Pending moderation reports.
- Drill-down từ từng metric sang danh sách tương ứng.
- Cảnh báo dữ liệu có thể cũ tối đa 60 giây.

Snapshot được worker tạo mỗi 30 giây và hết hạn sau 60 giây.

### Accounts

Danh sách hỗ trợ:

- Tìm bằng account reference, tên hoặc exact email.
- Lọc account state.
- Lọc recruiter-enabled.
- Lọc membership role và membership state.
- Phân trang 25/50/100 dòng.

Trang chi tiết hỗ trợ:

- Xem trạng thái và version tài khoản.
- Xem masked email và access roles.
- Xem Company memberships.
- Xem active sessions bằng opaque session reference, không trả session ID thật.
- Revoke một session.
- Revoke tất cả sessions.
- Suspend tài khoản và thu hồi sessions.
- Reinstate tài khoản; session cũ không được khôi phục.
- Xem security-notification delivery status.
- Xem audit history và private rationale có mã hóa.
- Ngăn admin tác động lên chính tài khoản của mình.
- Ngăn làm mất last usable administrator.

Account commands nằm trong transaction, kiểm tra version và ghi
audit/rationale/notification cùng lúc.

### Companies

- Có resource danh sách chỉ đọc gồm ID, display name và state.
- Không có chức năng tạo, sửa, xóa hoặc quản lý Company trực tiếp.

Lưu ý: `SafeList` đang đặt `rowClick="show"` nhưng resource Companies không đăng
ký `show` component. Đây là điểm UX nên kiểm tra vì click dòng có thể điều hướng
đến route detail không tồn tại.

### Company Memberships

Danh sách hiển thị:

- Membership reference.
- Company name/reference.
- Account name/reference.
- Role hiện tại.
- State.
- Prior approved role.

Các thao tác lifecycle:

```text
ACTIVE -> SUSPENDED
SUSPENDED -> ACTIVE
ACTIVE/SUSPENDED -> REMOVED
```

- Restore khôi phục prior approved role.
- `REMOVED` là trạng thái kết thúc, không có restore.
- Không tác động Candidate identity hoặc memberships ở Company khác.
- Không cho suspend/remove OWNER cuối cùng của Company.
- Remove yêu cầu typed confirmation riêng.
- Việc bảo vệ OWNER cuối cùng dùng PostgreSQL advisory transaction lock để
  tránh hai admin đồng thời cùng loại bỏ hai OWNER.

### Employer Verification

Danh sách hỗ trợ lọc:

- State.
- Company.
- Tax identifier.
- Applicant.
- Assignment: `UNASSIGNED`, `MINE`, `ANY`.

Trang review hỗ trợ:

- Xem applicant, Company, tax ID và submission version.
- Xem evidence đã được safety-check.
- Preview PNG được server chuẩn hóa.
- Download file dưới dạng attachment.
- Disable quyết định nếu evidence không truy cập được.
- Request changes với applicant-visible guidance.
- Reject với rejection category và applicant-visible reason.
- Approve và chọn role.
- Private note riêng, không gửi cho applicant.
- Step-up TOTP trước quyết định.

State machine:

```text
PENDING_CHECKS -> PENDING_REVIEW | CANCELLED | EXPIRED
PENDING_REVIEW -> CHANGES_REQUESTED | APPROVED | REJECTED | CANCELLED | EXPIRED
CHANGES_REQUESTED -> RESUBMITTED -> PENDING_CHECKS
APPROVED | REJECTED | CANCELLED | EXPIRED là terminal
```

Các mốc worker:

- Chậm safety check: 15 phút.
- `PENDING_CHECKS` hết hạn: 24 giờ.
- Evidence viewer outage: escalate sau 15 phút, notify sau 24 giờ và expire sau
  72 giờ.
- `CHANGES_REQUESTED` không phản hồi: expire sau 30 ngày.
- Resubmit tối đa 3 lần.

Evidence phải qua:

- ClamAV.
- Magic-byte media detection.
- Declared/detected media type matching.
- Structural decode.
- Server-side normalized preview.
- Private encrypted filesystem hoặc S3 storage.
- Không tạo public hoặc presigned reusable URL.

### Moderation Reports

Danh sách lọc theo:

- Target: Job, Company, Membership hoặc Candidate.
- Category.
- Priority: Critical, High hoặc Normal.
- State.
- Company.
- Tuổi báo cáo.
- Assignee.

Trang review hỗ trợ:

- Xem reporter, target và originating references.
- Xem normalized plain-text detail.
- Assign cho admin hiện tại.
- Thêm private investigation note.
- Resolve.
- Dismiss.
- Link đến một enforcement correlation đã được thực hiện độc lập.

Luồng moderation không tự động suspend account hoặc membership. Linking
enforcement chỉ nối report với một hành động đã được xác nhận riêng.

## API Routes

### Authentication

```text
POST /api/admin/auth/login
POST /api/admin/auth/two-factor
GET  /api/admin/auth/context
POST /api/admin/auth/step-up
POST /api/admin/auth/logout
```

### Dashboard và Accounts

```text
GET  /api/admin/dashboard
GET  /api/admin/accounts
GET  /api/admin/accounts/{accountId}/security
POST /api/admin/accounts/{accountId}/suspend
POST /api/admin/accounts/{accountId}/reinstate
POST /api/admin/accounts/{accountId}/sessions/revoke-all
POST /api/admin/accounts/{accountId}/sessions/{sessionReference}/revoke
GET  /api/admin/actions/{correlationId}/rationale
GET  /api/admin/audit-events/{correlationId}
```

### Companies và Memberships

```text
GET  /api/admin/companies
GET  /api/admin/company-memberships
GET  /api/admin/company-memberships/{membershipId}
POST /api/admin/company-memberships/{membershipId}/{action}
```

Giá trị `action`: `suspend`, `restore`, `remove`.

### Verification

```text
GET  /api/admin/verification-requests
GET  /api/admin/verification-requests/{requestId}
GET  /api/admin/verification-requests/{requestId}/evidence/{evidenceId}/preview
GET  /api/admin/verification-requests/{requestId}/evidence/{evidenceId}/download
POST /api/admin/verification-requests/{requestId}/request-changes
POST /api/admin/verification-requests/{requestId}/reject
POST /api/admin/verification-requests/{requestId}/approve
```

### Moderation

```text
GET  /api/admin/moderation-reports
GET  /api/admin/moderation-reports/{reportId}
POST /api/admin/moderation-reports/{reportId}/{action}
```

Giá trị `action`: `assign`, `note`, `resolve`, `dismiss`, `link-enforcement`.

### Các Route Liên Quan Ngoài Admin Origin

```text
GET  /api/recruiter/entitlement
POST /api/employer-verifications
POST /api/employer-verifications/{requestId}/{cancel|resubmit}
POST /api/moderation-reports
```

## Cơ Chế Xử Lý Chung

### 1. Exact-host routing

Proxy kiểm tra hostname chính xác:

- Admin host được rewrite nội bộ sang `/admin-console`.
- Candidate/recruiter không thể truy cập internal admin shell.
- Truy cập trực tiếp `/admin-console` trả `404`.
- Host không nằm trong cấu hình trả `404`.

### 2. Authentication và authority

Quá trình đăng nhập:

1. Kiểm tra account có active Platform Administrator Grant.
2. Kiểm tra account đã bật TOTP.
3. Kiểm tra password.
4. Tạo pre-auth cookie riêng cho admin origin.
5. Xác thực TOTP.
6. Tạo Better Auth session.
7. Designate session này làm admin session duy nhất của grant.
8. Nếu đăng nhập admin từ browser thứ hai, designated session trước bị revoke.

### 3. Server authorization trên mọi request

Mỗi protected API tự kiểm tra lại:

- Exact host và origin.
- `sec-fetch-site: same-origin` cho write.
- Better Auth session còn hợp lệ.
- CSRF token cho non-GET.
- Platform Administrator Grant đang `ACTIVE`, chưa hết hạn.
- Session hiện tại đúng designated session.
- Đã có initial TOTP.
- Sensitive action có TOTP proof không quá 15 phút.

React Admin chỉ kiểm soát giao diện; không được xem là security boundary.

### 4. Pessimistic command

Mỗi command gửi:

```text
If-Match-Version: <record version>
Idempotency-Key: <UUID>
X-CSRF-Token: <session-bound proof>
```

Server xử lý:

1. Kiểm tra version hiện tại.
2. Kiểm tra idempotency key.
3. Chạy transaction.
4. Thay đổi state.
5. Ghi immutable audit.
6. Mã hóa private rationale nếu có.
7. Tạo notification work/outbox nếu cần.
8. Trả correlation ID và version mới.

Retry cùng key/body trả lại kết quả cũ. Dùng cùng key với body hoặc target khác
trả `IDEMPOTENCY_CONFLICT`. Version cũ trả `409 STALE_CONFLICT`.

### 5. Client không lưu dữ liệu nhạy cảm lâu dài

- React Admin dùng `memoryStore`.
- Fetch luôn dùng `cache: no-store`.
- Query cache có `staleTime=0`, `gcTime=0` và không retry.
- Không có generic create/update/delete.
- Khi mất authority, cache bị clear và client logout.

### 6. Worker nền

| Loop | Chu kỳ |
| --- | ---: |
| Dashboard snapshot | 30 giây |
| Evidence safety check | 5 giây |
| Verification deadline | 60 giây |
| Security notification | 30 giây |
| Evidence/rationale retention | 60 giây |

Worker hỏng không được phép làm các web command bỏ qua authorization.

### 7. Audit, rationale và notification

- Audit events là append-only và liên kết bằng correlation ID.
- Private rationale được mã hóa AES-256-GCM.
- Rationale yêu cầu fresh step-up để đọc.
- Rationale không còn truy cập được sau 365 ngày và được xóa sau 366 ngày.
- Account suspension/reinstatement, revoke-all và membership lifecycle tạo
  durable SecurityNotificationWork.
- Revoke một session không tạo security notification.
- Verification sử dụng existing EmailOutbox với idempotency key riêng.
- Notification failure sau khi command commit không rollback state đã thay đổi.

## Cách Chạy Local

Trên PowerShell hiện tại, `npm.ps1` có thể bị Execution Policy chặn, vì vậy có
thể dùng `npm.cmd`.

```powershell
npm.cmd install
npm.cmd run env:init
npm.cmd run env:check
npm.cmd run db:up
npm.cmd run db:validate
npm.cmd run db:migrations:check
npm.cmd run db:deploy
```

Chuẩn bị một account:

- Account phải active và email đã verified.
- Đã enroll TOTP.
- Sau đó provision grant bằng operator shell:

```powershell
npm.cmd run admin:provision -- admin@example.com
```

Terminal 1:

```powershell
npm.cmd run dev
```

Terminal 2:

```powershell
npm.cmd run admin:worker
```

Kiểm tra worker:

```powershell
npm.cmd run admin:worker:probe
```

Mở:

```text
http://console.admin.localhost:3001
```

## Automated Test

### Focused suite

```powershell
npm.cmd run test:admin-management
```

Kết quả kiểm tra gần nhất:

```text
Test Files: 53 passed
Tests:      129 passed
```

Suite bao gồm:

- Unit tests.
- Backend integration tests.
- Contract tests.
- Frontend component tests.
- Accessibility component tests.
- Security tests.
- Architecture-boundary tests.
- Concurrency tests.
- Worker fake-clock tests.
- Performance evaluator tests.

### Contract và worker

```powershell
npm.cmd run admin:contracts --workspace @smarthire/web
npm.cmd run admin:worker:probe
npm.cmd run admin:moderation:migration:verify
```

Contract hiện tại:

```text
version: 0.2.0
pathCount: 32
drift: false
```

### Repository gates

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Performance evaluator không cần môi trường thật:

```powershell
npm.cmd run perf:admin-management:self-test
```

Performance đầy đủ cần dataset và cookie admin:

```powershell
$env:ADMIN_PERF_ORIGIN="http://console.admin.localhost:3001"
$env:ADMIN_PERF_AUTH_COOKIE="<better-auth-cookie>"
npm.cmd run perf:admin-management
```

### Playwright E2E

Các biến môi trường chính:

```powershell
$env:ADMIN_E2E_READY="1"
$env:ADMIN_E2E_ORIGIN="http://console.admin.localhost:3001"
$env:CANDIDATE_E2E_ORIGIN="http://localhost:3001"
$env:RECRUITER_E2E_ORIGIN="http://console.recruiter.localhost:3001"
$env:ADMIN_E2E_TARGET_ACCOUNT="Candidate"
npm.cmd run test:admin-management:e2e
```

Chỉ bật `ADMIN_E2E_READY=1` sau khi đã chuẩn bị controlled identities, TOTP,
authenticated fixtures, Companies, memberships, sessions, verification
requests, reports và notification failures.

## Manual Test Từng Luồng

### Authentication

1. Truy cập admin origin khi logout và xác nhận không thấy dữ liệu.
2. Đăng nhập bằng Candidate thường và xác nhận bị từ chối trung tính.
3. Đăng nhập admin chưa bật TOTP và xác nhận bị từ chối.
4. Đăng nhập admin hợp lệ và hoàn thành TOTP.
5. Đăng nhập browser thứ hai và xác nhận browser thứ nhất bị revoke.
6. Chờ quá 15 phút rồi suspend/revoke/approve và xác nhận xuất hiện Step-Up.
7. Logout rồi dùng Back/Forward và xác nhận dữ liệu cũ không xuất hiện.
8. Gọi admin API từ Candidate/recruiter origin và xác nhận `401/403/404`.

### Dashboard

1. Thay đổi dữ liệu nguồn.
2. Chờ worker tối đa 30-60 giây.
3. Kiểm tra `calculatedAt`.
4. Click từng metric.
5. Đối chiếu filter và số bản ghi.
6. Thay dữ liệu giữa snapshot và list load, sau đó kiểm tra cảnh báo chênh lệch.

### Accounts

1. Tìm theo ID, tên và exact email.
2. Lọc state/role/membership state.
3. Revoke một session và kiểm tra session còn lại vẫn hoạt động.
4. Revoke all và kiểm tra tất cả sessions bị chặn.
5. Suspend và kiểm tra account thành `SUSPENDED`, sessions bị revoke.
6. Reinstate và kiểm tra sessions cũ không sống lại.
7. Thử suspend chính admin đang thao tác và xác nhận bị chặn.
8. Thử loại bỏ last usable administrator và xác nhận bị chặn.
9. Mở cùng record ở hai browser, commit cùng version và xác nhận chỉ một
   command thành công.
10. Kiểm tra audit, rationale và notification status sau command.

### Memberships

1. Tạo một user có memberships ở hai Companies.
2. Suspend một membership.
3. Kiểm tra Candidate access và Company còn lại không đổi.
4. Restore và kiểm tra prior approved role.
5. Remove bằng typed confirmation.
6. Thử remove OWNER cuối cùng và xác nhận nhận `LAST_ACTIVE_OWNER`.
7. Kiểm tra recruiter entitlement bị thu hồi ngay.

### Verification

1. Candidate submit PDF/PNG/JPEG hợp lệ dưới 5 MB.
2. Kiểm tra request ở `PENDING_CHECKS`.
3. Chờ worker chuyển sang `PENDING_REVIEW`.
4. Mở preview/download và xác nhận response không chứa storage locator.
5. Request changes rồi resubmit file mới.
6. Thử resubmit quá 3 lần.
7. Reject và kiểm tra applicant notification.
8. Approve Company mới và kiểm tra Company active, applicant là OWNER.
9. Approve Company có sẵn và kiểm tra prerequisite hợp lệ.
10. Submit malware, sai magic type hoặc structure hỏng và xác nhận không thể
    preview/approve.
11. Mô phỏng concurrency giữa approve/cancel/resubmit.
12. Dùng fake clock kiểm tra các mốc 15 phút, 24 giờ, 72 giờ và 30 ngày.

### Moderation

1. Submit report từ public Job.
2. Submit Candidate/Company report từ application context hợp lệ.
3. Dùng target không có relationship và xác nhận hệ thống không enumerate.
4. Submit duplicate trong 24 giờ.
5. Kiểm tra rate/quota limit.
6. Lọc queue theo target/category/priority/state.
7. Assign, thêm note, resolve hoặc dismiss.
8. Kiểm tra terminal report không cho terminal action tiếp.
9. Link enforcement correlation.
10. Xác nhận report không tự suspend account hoặc membership.

### Accessibility

Kiểm tra bằng keyboard:

- Dashboard.
- Accounts list/detail.
- Membership list/detail.
- Verification list/detail/evidence dialog.
- Moderation list/detail.
- Step-up và confirmation dialogs.
- Focus trap và focus restore.
- Error/success được screen reader announce.
- Trạng thái không phụ thuộc chỉ vào màu sắc.

Manual protocols:

- `web/tests/usability/admin-management/account-security-protocol.md`
- `web/tests/usability/admin-management/verification-review-protocol.md`
- `web/tests/accessibility/admin-management/manual-screen-reader-protocol.md`

## Những Phần Chưa Hoàn Tất

- Các Playwright E2E hiện mới là khung kiểm tra cấp cao; chưa tự động hóa đầy
  đủ credential/OTP/session fixtures và toàn bộ thao tác stateful.
- `ADMIN_E2E_READY=1` chỉ nên bật sau khi có fixture đã đăng nhập và dataset
  được kiểm soát.
- 10 tasks còn mở chủ yếu là full E2E journeys, evidence-policy approval,
  performance thật và release walkthrough.
- Performance 15 phút với 10 admin đồng thời chưa chạy.
- NVDA/Firefox và VoiceOver/Safari chưa chạy.
- Legal/Security/Operations approvals cho business evidence chưa có.
- Existing-company prerequisite integration chưa được xác nhận.
- Repository-wide `npm test` vẫn có failure từ các feature khác; focused admin
  suite hiện xanh.
- `release-validation.md` vẫn ghi số cũ `48 files/106 tests`; kết quả chạy trực
  tiếp mới hơn là `53 files/129 tests`.
- Trạng thái release chính thức vẫn là **NOT READY FOR RELEASE**.

## Tài Liệu Tham Chiếu

- `spec-kit/specs/006-admin-management/plan.md`
- `spec-kit/specs/006-admin-management/spec.md`
- `spec-kit/specs/006-admin-management/quickstart.md`
- `spec-kit/specs/006-admin-management/data-model.md`
- `spec-kit/specs/006-admin-management/release-validation.md`
- `spec-kit/specs/006-admin-management/contracts/admin-api.openapi.yaml`
- `web/src/frontend/features/admin/app/admin-app.tsx`
- `web/src/backend/security/admin-request-boundary.ts`
- `web/src/backend/admin/workers/admin-worker-entry.ts`
