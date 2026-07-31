# Báo cáo tổng hợp nhóm 002 — Candidate Profile & Account Management

> Cập nhật: 31/07/2026  
> Nhánh: `002-candidate-profile-account-management`  
> Trạng thái tổng thể: **Release Candidate có điều kiện**

## 1. Tóm tắt điều hành

Nhóm tính năng `002-candidate-profile-account-management` đã hoàn thành phần
triển khai mã nguồn, migration, bảo mật, tài liệu vận hành và toàn bộ cổng kiểm
thử tự động. Hệ thống cung cấp bốn luồng chính cho Candidate:

1. quản lý hồ sơ nghề nghiệp;
2. quản lý danh tính tài khoản và thay đổi email;
3. quản lý tùy chọn cá nhân;
4. thay đổi mật khẩu an toàn và thu hồi các phiên đăng nhập khác.

Tiến độ Spec Kit hiện tại:

| Chỉ số           | Kết quả |
| ---------------- | ------: |
| Tổng số task     |     142 |
| Đã hoàn thành    |     140 |
| Còn mở           |       2 |
| Tỷ lệ hoàn thành |   98,6% |

Hai task còn mở không phải lỗi triển khai:

- **T136:** cần kiểm tra trực tiếp bằng bàn phím và screen reader trên trình
  duyệt thật;
- **T137:** cần thực hiện nghiên cứu usability với tối thiểu 10 người dùng đại
  diện và đạt ít nhất 90% hoàn thành ngay lần đầu cho từng tác vụ.

Vì chưa có hai bằng chứng con người này, project chưa nên tuyên bố rằng 100%
tiêu chí nghiệm thu đã hoàn thành. Tuy nhiên, phần mã nguồn hiện đạt chất lượng
ứng viên phát hành theo toàn bộ bằng chứng tự động đã định nghĩa.

## 2. Phạm vi tính năng đã triển khai

### 2.1. Hồ sơ nghề nghiệp — Professional Profile

Trang chính: `/profile`.

Candidate có thể xem và chỉnh sửa hồ sơ nghề nghiệp của chính mình, gồm:

- thông tin cơ bản:
  - headline;
  - phần giới thiệu/tóm tắt;
  - số điện thoại;
  - địa điểm;
- kỹ năng;
- kinh nghiệm làm việc;
- học vấn;
- liên kết mạng xã hội hoặc liên kết nghề nghiệp.

Các khả năng đã có:

- trạng thái loading, lỗi tải, hồ sơ trống hợp lệ và thông báo “chưa điền”;
- nút Save riêng cho từng phần, không autosave theo từng trường;
- thêm, sửa, xóa và sắp xếp lại kỹ năng, kinh nghiệm, học vấn, liên kết;
- giữ nguyên dữ liệu người dùng đã nhập khi request lưu thất bại;
- refetch dữ liệu authoritative từ server sau khi lưu;
- chống submit trùng trong lúc request đang chạy;
- thông báo thành công, lỗi, cảnh báo chuẩn hóa và xung đột;
- toast qua ARIA live kết hợp thông báo cố định trong form;
- tự đưa focus đến lỗi phù hợp;
- hỗ trợ thao tác bàn phím và giao diện 320 px;
- hỗ trợ `prefers-reduced-motion`.

Giới hạn và quy tắc dữ liệu:

| Dữ liệu      | Quy tắc chính                                       |
| ------------ | --------------------------------------------------- |
| Headline     | Tùy chọn, tối đa 200 ký tự                          |
| Summary      | Tùy chọn, tối đa 5.000 ký tự                        |
| Phone        | Tùy chọn, tối đa 32 ký tự, tổng 7–15 chữ số ASCII   |
| Location     | Tùy chọn, tối đa 160 ký tự                          |
| Skills       | Tối đa 50 kỹ năng duy nhất, mỗi tên tối đa 80 ký tự |
| Experience   | Tối đa 50 mục                                       |
| Education    | Tối đa 50 mục                                       |
| Social links | Tối đa 10 URL duy nhất, chỉ `http`/`https`          |

Xử lý kỹ năng:

- dùng catalog `Skill` dùng chung thay vì lưu chuỗi rời rạc cho từng hồ sơ;
- chuẩn hóa khoảng trắng và so sánh không phân biệt hoa/thường;
- vẫn giữ cách viết hiển thị và dấu tiếng Việt do Candidate chọn;
- gợi ý kỹ năng đã có trong catalog;
- cho phép tạo kỹ năng mới sau chuẩn hóa;
- xử lý race khi hai request cùng tạo một kỹ năng chuẩn hóa;
- xóa kỹ năng khỏi một hồ sơ chỉ xóa quan hệ, không xóa bản ghi catalog dùng
  chung.

Xử lý kinh nghiệm và học vấn:

- mỗi mục có ID ổn định và thứ tự rõ ràng;
- kiểm tra ngày bắt đầu, ngày kết thúc và trạng thái hiện tại;
- công việc hiện tại không được có ngày kết thúc;
- học vấn hiện tại có thể có ngày hoàn thành dự kiến trong tương lai;
- ngày kết thúc không được trước ngày bắt đầu;
- các trường bắt buộc và giới hạn độ dài được kiểm tra lại ở server.

Xử lý đồng thời:

- mỗi hồ sơ có `revision`;
- server khóa hàng và lưu từng section bằng transaction;
- submission hợp lệ nhưng dùng revision cũ vẫn được áp dụng theo chiến lược
  last-write-wins;
- response trả `conflictApplied: true`;
- giao diện hiển thị cảnh báo rõ rằng thay đổi đồng thời đã bị ghi đè;
- lỗi giữa transaction không tạo dữ liệu con mồ côi hoặc trạng thái lưu dở.

### 2.2. Danh tính tài khoản — Account Identity

Trang chính: `/profile/account`.

Candidate có thể:

- xem họ tên tài khoản;
- xem email đang có hiệu lực;
- xem metadata tài khoản ở dạng chỉ đọc;
- xem email đang chờ xác minh và thời điểm hết hạn;
- cập nhật họ tên từ 1 đến 150 ký tự sau chuẩn hóa.

Thông tin danh tính được tách khỏi hồ sơ nghề nghiệp. API không trả proof,
digest, session ID, outbox ID hay correlation nội bộ.

### 2.3. Thay đổi email an toàn

Luồng thay đổi email gồm request và verify riêng biệt:

1. Candidate đăng nhập bằng phiên hợp lệ;
2. nhập email mới và mật khẩu hiện tại để đáp ứng recent authentication;
3. server chuẩn hóa email và kiểm tra uniqueness trên cả email đang dùng lẫn
   email đang được giữ chỗ;
4. server tạo pending request có thời hạn 30 phút;
5. hệ thống ghi đồng thời:
   - một email xác minh gửi đến địa chỉ mới;
   - một email cảnh báo bảo mật gửi đến địa chỉ cũ;
   - audit event cho kết quả request;
6. Candidate mở `/verify-email-change#proof=...`;
7. trang xóa proof khỏi address bar trước khi thực hiện hành động;
8. Candidate bấm xác nhận;
9. server khóa và kiểm tra lại request, uniqueness, thời hạn và ownership;
10. email mới chỉ trở thành email hiệu lực sau transaction verify thành công.

Thuộc tính bảo mật của luồng:

- proof ngẫu nhiên 32 byte;
- database chỉ lưu HMAC digest của proof;
- proof tạm thời trong outbox được mã hóa AES-256-GCM;
- proof nằm trong URL fragment nên không được gửi trong HTTP GET;
- GET trang verify không thực hiện mutation;
- verification dùng một lần;
- request mới supersede mọi request cũ chưa dùng;
- request lặp lại với cùng idempotency key và cùng dữ liệu trả kết quả cũ;
- dùng cùng key cho email khác bị từ chối conflict;
- email mới chưa xác minh không thể login hoặc recovery;
- email cũ tiếp tục hoạt động trước verify và ngừng hoạt động sau verify;
- proof malformed, hết hạn, superseded, đã dùng hoặc mất uniqueness đều không
  thay đổi identity;
- lỗi provider không rollback pending request đã commit.

Recipient của email thay đổi địa chỉ được snapshot và mã hóa theo từng purpose:

- `email-change-verification.v1`;
- `email-change-old-address.v1`.

Worker chỉ giải mã recipient ngay trước lời gọi đến email provider.

### 2.4. Tùy chọn tài khoản — Account Preferences

Trang chính: `/profile/preferences`.

Các tùy chọn được lưu authoritative trong PostgreSQL và dùng chung giữa các
trình duyệt/thiết bị:

- ngôn ngữ: `vi` hoặc `en`;
- timezone IANA hợp lệ;
- email cập nhật đơn ứng tuyển;
- email gợi ý công việc;
- email bảo mật tài khoản.

Giá trị mặc định khi chưa có bản ghi:

- ngôn ngữ `vi`;
- timezone `Asia/Ho_Chi_Minh`;
- cả ba loại email đều bật.

Quy tắc quan trọng:

- `account_security` luôn bắt buộc bật;
- UI hiển thị rõ đây là cài đặt bắt buộc và không cho tắt;
- server và CHECK constraint vẫn từ chối dữ liệu `false` bị giả mạo;
- category không hỗ trợ hoặc giá trị không phải boolean bị từ chối;
- toàn bộ preference được cập nhật như một tập hợp nguyên tử;
- nếu một giá trị không hợp lệ, tập hợp trước đó được giữ nguyên;
- timezone cũ không còn được hệ thống hiện tại hỗ trợ vẫn có thể được hiển thị
  và bảo toàn cho đến khi người dùng chủ động đổi timezone.

### 2.5. Thay đổi mật khẩu an toàn

Trang chính: `/profile/security`.

Candidate phải cung cấp:

- mật khẩu hiện tại;
- mật khẩu mới;
- xác nhận mật khẩu mới.

Chính sách mật khẩu:

- độ dài từ 12 đến 128 ký tự;
- chấp nhận Unicode và khoảng trắng;
- không tự cắt dữ liệu;
- phải khác mật khẩu hiện tại;
- phải vượt qua kiểm tra mật khẩu phổ biến/đã bị lộ;
- xác nhận phải trùng khớp;
- không áp đặt quy tắc bắt buộc chữ hoa, chữ thường, số hoặc ký hiệu;
- không lưu lịch sử mật khẩu cũ.

Chống đoán mật khẩu hiện tại:

- chỉ trường hợp mật khẩu hiện tại sai mới tăng bộ đếm;
- lỗi mật khẩu mới hoặc lỗi xác nhận không tăng bộ đếm;
- năm lần sai trong cửa sổ 15 phút khóa thao tác đổi mật khẩu trong 15 phút;
- bộ đếm dùng trạng thái PostgreSQL chung cho tất cả phiên;
- race giữa các request được serialize;
- response khóa có `Retry-After` an toàn;
- đổi mật khẩu thành công xóa cửa sổ thất bại.

Quy trình đổi mật khẩu được triển khai dưới dạng durable operation có thể tiếp
tục sau lỗi:

1. `INTENT_RECORDED`;
2. `PASSWORD_UPDATED`;
3. `OTHER_SESSIONS_REVOKED`;
4. `FINALIZED`.

Nếu lỗi giữa các mốc, operation chuyển `FAILED_RETRYABLE` với mã lỗi an toàn.
Client phải retry từ cùng phiên khởi tạo, cùng idempotency key và cùng nội dung
submission. Hệ thống không trả thành công cho đến khi:

- mật khẩu mới thực sự có hiệu lực;
- phiên khởi tạo vẫn sử dụng được;
- mọi phiên còn lại đã bị thu hồi và được kiểm tra là không còn usable;
- đúng một email xác nhận đã được đưa vào outbox;
- đúng một audit kết quả cuối đã được ghi;
- operation đã finalized.

Email xác nhận luôn gửi đến email đang có hiệu lực, không gửi đến email mới còn
pending.

## 3. Nền tảng bảo mật và tính toàn vẹn

### 3.1. Xác thực, phân quyền và chống giả mạo

- tái sử dụng Better Auth 1.6.25 làm chủ sở hữu duy nhất của credential và
  browser session;
- không tạo JWT/session mechanism thứ hai;
- xác định user chỉ từ phiên server-side;
- không tin `userId`, `accountId`, `profileId` hoặc session ID do client gửi;
- kiểm tra trạng thái `ACTIVE` ở server;
- mọi mutation kiểm tra exact Origin, Fetch Metadata và CSRF proof;
- request body có giới hạn kích thước;
- schema Zod strict từ chối field lạ;
- response dữ liệu nhạy cảm dùng `Cache-Control: no-store`;
- `/verify-email-change` có CSP và `Referrer-Policy: no-referrer`.

### 3.2. Chống XSS và chuẩn hóa dữ liệu

- `sanitize-html` 2.17.6 chỉ được import ở server;
- text được NFKC-normalize;
- loại bỏ script, style, event handler, markup và control character nguy hiểm;
- không dùng `dangerouslySetInnerHTML` cho dữ liệu hồ sơ;
- giá trị sau làm sạch được lưu dưới dạng plain text;
- giữ nguyên dấu tiếng Việt;
- nội dung bị làm sạch thành rỗng tạo cảnh báo hoặc lỗi tùy trường bắt buộc.

### 3.3. Audit và bảo vệ nguồn mạng

Các sự kiện email/mật khẩu quan trọng tạo audit event allowlisted với:

- actor;
- action;
- result;
- target;
- timestamp;
- correlation ID;
- network digest được bảo vệ.

Hệ thống không lưu raw IP cho Feature 002. IP được:

- chọn theo số trusted proxy hop cấu hình rõ ràng;
- rút gọn thành IPv4 `/24` hoặc IPv6 `/56`;
- HMAC bằng context riêng từ `TOKEN_SECRET`;
- chỉ lưu digest.

Production bắt buộc `AUDIT_TRUSTED_PROXY_HOPS >= 1`; local/test dùng `0`. Chuỗi
forwarded tối đa 20 phần tử, hop tin cậy tối đa 10 và lỗi topology làm sensitive
mutation fail closed.

### 3.4. Transactional email outbox

- mutation quan trọng commit dữ liệu và email intent trong cùng transaction;
- provider gửi mail nằm ngoài transaction và không được rollback dữ liệu lõi;
- idempotency key ngăn tạo intent trùng;
- worker lấy tối đa 10 hàng bằng `FOR UPDATE SKIP LOCKED`;
- lease mặc định 60 giây;
- polling khi rảnh mỗi 1 giây;
- retry bắt đầu khoảng 30 giây, exponential backoff đến tối đa 1 giờ, có jitter
  ±10%;
- lỗi không retry được hoặc lần claim thất bại thứ năm chuyển sang `DEAD`;
- `DEAD` tạo đúng một audit `email.delivery_failed`;
- không lưu raw provider error, chỉ lưu `safeErrorCode`;
- envelope của outbox là immutable;
- migration forward-fix chỉ cho phép FK `userId`/`securityTokenId` chuyển từ có
  giá trị sang `NULL` khi cleanup, không cho phép retarget email.

## 4. Dữ liệu và migration

Feature 002 bổ sung 10 model chính:

1. `CandidateProfile`;
2. `ProfileExperience`;
3. `ProfileEducation`;
4. `Skill`;
5. `CandidateProfileSkill`;
6. `SocialLink`;
7. `AccountPreferences`;
8. `EmailChangeRequest`;
9. `PasswordChangeAttemptWindow`;
10. `PasswordChangeOperation`.

Quan hệ quan trọng:

- mỗi `CandidateIdentity` có tối đa một `CandidateProfile`;
- migration backfill tạo đúng một profile trống cho identity đã tồn tại;
- profile sở hữu experience, education, selection skill và social link;
- xóa profile vật lý trong quy trình retention tương lai sẽ cascade dữ liệu
  con;
- `Skill` là catalog dùng chung và không cascade theo một hồ sơ;
- preference, email request và password operation thuộc `UserAccount`;
- outbox/audit bền vững không bị mất chỉ vì quan hệ account bị cleanup.

Project hiện có 9 migration và database kiểm thử báo schema đã cập nhật đầy đủ:

- `001_identity_foundation`;
- `002_email_outbox_worker`;
- `003_totp_challenge_replay`;
- `004_password_reset_recovery_operations`;
- `005_full_account_recovery`;
- `006_add_two_factor_lockout_fields`;
- `007_candidate_profile_account_management`;
- `20260731025418_test_ready`;
- `20260731191000_preserve_outbox_on_fk_cleanup`.

Migration `20260731025418_test_ready` là migration có sẵn được bảo vệ và không
bị chỉnh sửa trong quá trình triển khai nhóm 002.

## 5. API và giao diện

OpenAPI định nghĩa 7 path với tổng cộng 10 operation:

| Path                                      | Operation chính                  |
| ----------------------------------------- | -------------------------------- |
| `/api/account/profile`                    | GET hồ sơ, PATCH lưu một section |
| `/api/account/profile/skills/suggestions` | GET gợi ý skill catalog          |
| `/api/account/identity`                   | GET/PATCH danh tính              |
| `/api/account/preferences`                | GET/PUT preferences              |
| `/api/account/email-change/request`       | POST tạo yêu cầu đổi email       |
| `/api/account/email-change/verify`        | POST xác minh proof              |
| `/api/account/password/change`            | POST đổi mật khẩu                |

Các Route Handler chỉ làm nhiệm vụ transport, parsing và mapping response. Logic
nghiệp vụ nằm ở service; truy cập PostgreSQL nằm ở repository. Server Component
được phép gọi service trực tiếp, không tự gọi HTTP nội bộ.

## 6. Kiến trúc và công nghệ

| Thành phần           | Công nghệ/phiên bản chính                                  |
| -------------------- | ---------------------------------------------------------- |
| Runtime              | Node.js 24.18.x, npm 11.16.x                               |
| Frontend/backend web | Next.js 16.2.11 App Router, React 19.2.3, TypeScript 5.9.3 |
| Database             | PostgreSQL 16.12                                           |
| ORM/migration        | Prisma 7.9.0                                               |
| Authentication       | Better Auth 1.6.25                                         |
| Form                 | React Hook Form 7.82.0                                     |
| Validation           | Zod 4.3.6                                                  |
| Query                | TanStack Query 5.101.4                                     |
| Notification         | Sonner 2.0.7                                               |
| Text sanitizer       | sanitize-html 2.17.6                                       |
| Email                | Durable outbox + capture/SMTP/Resend adapter               |
| Test                 | Vitest 4.1.10, Playwright 1.57.0                           |

Kiến trúc tuân theo luồng:

```text
Browser / Server Component
  -> Next.js Route Handler hoặc in-process service
  -> Service
  -> Repository / Better Auth gateway / Email outbox
  -> PostgreSQL
```

## 7. Kết quả kiểm thử và đo lường

### 7.1. Cổng phát hành cuối

| Hạng mục                    | Kết quả                                           |
| --------------------------- | ------------------------------------------------- |
| Environment check           | PASS                                              |
| Prettier                    | PASS                                              |
| ESLint                      | PASS — 0 lỗi, 0 cảnh báo                          |
| TypeScript                  | PASS                                              |
| Prisma validate/generate    | PASS                                              |
| Prisma migrate status       | PASS — 9 migration, schema up to date             |
| Migration clean database    | PASS                                              |
| Migration từ Feature 001    | PASS                                              |
| Vitest                      | PASS — 123 file, 527 test                         |
| Production build            | PASS — 49 route                                   |
| Playwright desktop + mobile | PASS — 40/40 test                                 |
| npm audit                   | PASS — không có vulnerability chưa được chấp nhận |

Playwright chạy serial bằng một worker với PostgreSQL thật và capture-email:

- 20/20 journey desktop Chromium;
- 20/20 journey Chromium tại viewport 320 × 720;
- 8/8 biến thể journey riêng của bốn user story nhóm 002;
- toàn bộ regression của Feature 001 về đăng ký, đăng nhập, recovery, session,
  TOTP, navigation và responsive đều đạt.

### 7.2. Performance

Đo trên production build với dataset tối đa:

- 50 skills;
- 50 experience;
- 50 education;
- 10 social links;
- 5 session đang hoạt động;
- 100 warm sample cho mỗi nhóm đo.

Kết quả view p95, ngân sách tối đa 3.000 ms:

| View                 |       p95 |
| -------------------- | --------: |
| Professional profile | 869,11 ms |
| Account identity     | 402,81 ms |
| Preferences          | 116,13 ms |
| Security             | 152,50 ms |

Kết quả mutation p95, ngân sách tối đa 2.000 ms:

| Mutation         |       p95 |
| ---------------- | --------: |
| Profile save     | 461,51 ms |
| Identity save    | 224,81 ms |
| Preferences save | 300,93 ms |

Sau response đổi mật khẩu thành công, bốn phiên khác bị từ chối lần lượt trong:

- 33,31 ms;
- 34,87 ms;
- 34,83 ms;
- 35,32 ms.

Tất cả đều thấp hơn mục tiêu 2 giây; phiên khởi tạo vẫn hoạt động và số phiên
cuối cùng đúng bằng 1.

### 7.3. Accessibility tự động

- 5 file accessibility;
- 33 test tự động;
- kiểm tra label, keyboard semantics, focus contract, ARIA live/status/alert,
  non-color cues, reduced motion và quy tắc 320 px;
- toàn bộ đạt.

Các tỷ lệ contrast tiêu biểu:

| Cặp màu                  |   Tỷ lệ | Ngưỡng | Kết quả |
| ------------------------ | ------: | -----: | ------- |
| Focus ring / nền trắng   |  3,89:1 |    3:1 | PASS    |
| Focus ring / nút forest  |  3,16:1 |    3:1 | PASS    |
| Viền control / nền trắng |  3,43:1 |    3:1 | PASS    |
| Text chính / surface     | 16,66:1 |  4,5:1 | PASS    |
| Text muted / surface     |  4,56:1 |  4,5:1 | PASS    |

## 8. Đánh giá trạng thái hiện tại của project

| Khía cạnh                 | Trạng thái            | Đánh giá                                                                          |
| ------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| Chức năng nhóm 002        | 🟢 Tốt                | Bốn user story đã triển khai đầy đủ                                               |
| Data integrity/migration  | 🟢 Tốt                | Transaction, constraint, backfill và forward-fix đã được kiểm chứng               |
| Security/privacy          | 🟢 Tốt                | Ownership, CSRF/origin, redaction, protected proof/recipient và audit đều có test |
| Automated regression      | 🟢 Tốt                | 527 Vitest + 40 Playwright đều đạt                                                |
| Performance               | 🟢 Tốt                | Tất cả p95 thấp hơn nhiều so với ngân sách                                        |
| Accessibility tự động     | 🟢 Tốt                | 33 kiểm tra và contrast đều đạt                                                   |
| Accessibility thủ công    | 🟡 Chưa đủ bằng chứng | Chưa quan sát trực tiếp bằng screen reader và keyboard trên browser thật          |
| Usability người dùng thật | 🟡 Chưa thực hiện     | Chưa có mẫu tối thiểu 10 người và ngưỡng 90%                                      |
| Production deployment     | 🟡 Chưa xác nhận      | Build sẵn sàng nhưng chưa có bằng chứng deploy/availability trên production       |
| Git/review                | 🟡 Cần xử lý          | Working tree còn nhiều thay đổi và chưa có commit triển khai cuối                 |

### Kết luận đánh giá

Project hiện ở mức **Release Candidate có điều kiện**:

- có thể tiếp tục sang bước review code, tạo commit/PR và chuẩn bị môi trường
  staging;
- chưa nên tuyên bố hoàn tất nghiệm thu toàn bộ Feature 002 cho đến khi T136 và
  T137 có bằng chứng thật;
- chưa nên deploy production trực tiếp từ working tree hiện tại vì thay đổi chưa
  được commit và review;
- không phát hiện blocker kỹ thuật trong code, migration, test, build hoặc hiệu
  năng.

Trạng thái Git tại thời điểm lập báo cáo:

- nhánh hiện tại: `002-candidate-profile-account-management`;
- commit gần nhất: `fb9535d` — `Fixed Critical, high, medium, ready for implement`;
- implementation cuối chưa được commit;
- working tree chứa nhiều file modified/untracked của quá trình triển khai và
  cần được review theo phạm vi trước khi commit;
- file `.claude/settings.local.json` và các thay đổi không thuộc feature cần
  được giữ tách biệt khi chuẩn bị commit.

## 9. Hạn chế và tính năng ngoài phạm vi

Các nội dung sau chủ động không thuộc Feature 002:

- upload, parse hoặc review CV;
- avatar và document management;
- public/recruiter profile view;
- candidate recommendation engine;
- profile completeness score;
- dùng profile làm điều kiện ngầm để nộp đơn;
- SMS hoặc xác thực qua số điện thoại;
- account deletion, suspension, reinstatement;
- chỉnh sửa tài khoản bởi administrator;
- demographic hoặc legal-identity fields mới;
- thay thế luồng đăng ký, login, recovery, TOTP hoặc quản lý session của Feature
  001;
- AI scoring hoặc quyết định tuyển dụng.

Hard deletion mới chỉ được tài liệu hóa ranh giới cho tính năng tương lai; Feature
002 không cung cấp API/UI xóa vật lý tài khoản.

## 10. Công việc còn lại để nghiệm thu đầy đủ

### 10.1. Hoàn thành T136 — Accessibility thủ công

Cần chạy trên desktop và 320 px, có reduced motion bật/tắt, ghi rõ phiên bản
browser và assistive technology:

- thứ tự Tab và khả năng thoát focus;
- focus ring thực tế trên từng background;
- announcement đúng một lần cho success, validation, conflict, lock và retry;
- ý nghĩa reorder/remove/mandatory state khi không dựa vào màu;
- computed motion;
- `scrollWidth <= clientWidth` ở trạng thái dữ liệu đầy và lỗi.

### 10.2. Hoàn thành T137 — Usability study

- tối thiểu 10 người tham gia đại diện;
- mỗi người thực hiện cả bốn tác vụ;
- tối thiểu 9/10 người hoàn thành từng tác vụ ngay lần đầu, không cần trợ giúp;
- ghi thiết bị, viewport, ngôn ngữ, thời gian, hỗ trợ accessibility và blocker;
- không thay người tham gia sau khi đã thấy kết quả;
- không lấy automated test hoặc AI walkthrough thay cho bằng chứng người dùng.

### 10.3. Chuẩn bị release

1. review toàn bộ diff theo feature;
2. tách file local/unrelated khỏi commit;
3. tạo commit và pull request;
4. chạy lại cổng CI trên commit cố định;
5. deploy staging với trusted-proxy và email provider đúng cấu hình;
6. thực hiện T136/T137;
7. chỉ phát hành production khi compliance không còn gap bắt buộc.

## 11. Lệnh chạy và kiểm tra chính

Thiết lập local:

```bash
npm run env:init
npm ci
npm run db:up
npm run env:check
npm run db:migrate
npm run db:verify
npm run dev
```

Kiểm tra tập trung nhóm 002:

```bash
npm run test:profile-account --workspace @smarthire/web
npm run test:e2e --workspace @smarthire/web -- tests/system/e2e/profile-account
```

Cổng release đầy đủ:

```bash
npm run env:check
npm run db:validate
npm run db:verify
npm run format --workspace @smarthire/web
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run perf:profile-account
```

## 12. Tài liệu và bằng chứng liên quan

- Spec: `spec-kit/specs/002-candidate-profile-account-management/spec.md`
- Kế hoạch: `spec-kit/specs/002-candidate-profile-account-management/plan.md`
- Task: `spec-kit/specs/002-candidate-profile-account-management/tasks.md`
- OpenAPI: `spec-kit/specs/002-candidate-profile-account-management/contracts/openapi.yaml`
- Quickstart: `spec-kit/specs/002-candidate-profile-account-management/quickstart.md`
- Release regression:
  `spec-kit/specs/002-candidate-profile-account-management/checklists/release-results.md`
- Compliance:
  `spec-kit/specs/002-candidate-profile-account-management/checklists/release-compliance.md`
- Performance:
  `spec-kit/specs/002-candidate-profile-account-management/checklists/performance-results.md`
- Accessibility:
  `spec-kit/specs/002-candidate-profile-account-management/checklists/accessibility-results.md`
- Usability protocol:
  `spec-kit/specs/002-candidate-profile-account-management/checklists/usability-study.md`
- Runbook bảo mật: `docs/operations/profile-account-security.md`
- Runbook vòng đời dữ liệu:
  `docs/operations/profile-account-data-lifecycle.md`

---

**Kết luận cuối:** Nhóm 002 đã hoàn tất phần kỹ thuật và đạt toàn bộ cổng tự
động. Trạng thái phù hợp nhất hiện tại là **Release Candidate có điều kiện**,
chờ accessibility audit trực tiếp, usability study với người dùng thật, review
Git và quy trình staging/production.
