# Kế hoạch chuẩn hóa Recruitment Stage và cải thiện trải nghiệm Applied Jobs

**Trạng thái tài liệu:** Implemented — chờ xác minh migration/E2E trên PostgreSQL  
**Ngày rà soát:** 2026-08-08  
**Phạm vi chính:** Candidate Jobs/Applied, recruiter pipeline, application history, notification và các hợp đồng dữ liệu liên quan  
**Nguồn yêu cầu chuẩn:** `docs/vision document/vision_document.md`

> **Cập nhật triển khai 2026-08-08:** canonical contract, stage history/version,
> Candidate list/detail API, giao diện My applications, loại bỏ application mirror,
> recruiter transition endpoint, audit và email outbox đã được hiện thực. Repository
> hiện chưa có màn hình recruiter Kanban để nối trực tiếp; endpoint transition dùng
> chung đã sẵn sàng cho bề mặt đó. Prisma/typecheck/lint/unit/component/build đã pass;
> migration và E2E dùng database cần chạy lại khi PostgreSQL/Docker khả dụng.

## 1. Tóm tắt điều hành

Hệ thống hiện có hai mô hình trạng thái ứng tuyển song song:

- Database đã dùng đúng enum canonical gồm 9 trạng thái: `APPLIED`, `VIEWED`, `SHORTLISTED`, `INTERVIEWING`, `OFFERED`, `HIRED`, `OFFER_DECLINED`, `REJECTED`, `WAITLISTED`.
- Trang `/jobs/applied` lại đọc application mirror từ `web/data/jobs/user-job-state.json` và hiển thị bộ trạng thái cũ: `submitted`, `viewed`, `screening`, `considering`, `matched`, `not_fit`.

Vì vậy, đây không chỉ là lỗi copy hoặc màu badge. Nguyên nhân gốc là Applied Jobs chưa đọc nguồn dữ liệu application chính thức trong database. Sau khi ứng viên nộp hồ sơ, luồng hiện tại ghi application vào database với stage `APPLIED`, sau đó frontend lại ghi thêm một bản sao cục bộ với status `submitted`. Hai nguồn này có taxonomy, vòng đời và khả năng hoạt động trên Docker/production khác nhau nên dễ gây sai trạng thái, mất dữ liệu hoặc hiển thị không nhất quán.

Kết quả mục tiêu của kế hoạch này là:

1. Database trở thành nguồn sự thật duy nhất cho recruitment stage.
2. Toàn hệ thống dùng đúng 9 trạng thái canonical và một bộ copy thống nhất.
3. Mỗi thay đổi stage có lịch sử bất biến, audit, kiểm soát cạnh tranh và notification sau khi transaction thành công.
4. Candidate có trang “My applications” rõ ràng, đẹp, responsive và theo dõi được lịch sử được phép xem.
5. Recruiter pipeline và Candidate Applied Jobs nhìn cùng một dữ liệu, không còn application mirror trong JSON.
6. `scoring_status` của AI tiếp tục độc lập tuyệt đối với recruitment stage.

## 2. Căn cứ và nguyên tắc bắt buộc

### 2.1. Nguồn yêu cầu

Các điểm cần giữ đúng khi triển khai:

- `docs/vision document/vision_document.md:29`, `:272` và `:444` định nghĩa 9 recruitment stages canonical.
- `docs/vision document/vision_document.md:444` và `:616` yêu cầu tiến trình AI dùng `scoring_status` riêng, không được làm thay đổi recruitment stage.
- `docs/analysis-and-design/use_cases/Specification.md:2048` yêu cầu Candidate xem danh sách ứng tuyển, lọc theo trạng thái được phép và xem lịch sử stage được phép hiển thị.
- `docs/analysis-and-design/use_cases/Specification.md:2673` trở đi yêu cầu recruiter pipeline/Kanban, cập nhật stage có kiểm tra quyền, transaction, lịch sử và xử lý cập nhật đồng thời.
- `spec-kit/specs/003-job-board-and-advanced-search/spec.md` xác định `Submitted` là kết quả của hành động nộp hồ sơ; application được tạo ở stage canonical `Applied`.

### 2.2. Nguyên tắc miền nghiệp vụ

- Recruitment stage là quyết định tuyển dụng do con người kiểm soát; AI không tự động đẩy ứng viên sang stage khác.
- `Application submitted` là thông báo kết quả hành động, không phải một stage riêng.
- Không tạo stage giả để làm đẹp timeline. Nếu recruiter chuyển thẳng từ `Applied` sang `Shortlisted`, lịch sử phải ghi đúng bước chuyển đó, không chèn một event `Viewed` không có thật.
- Candidate chỉ thấy dữ liệu của chính mình và chỉ thấy phần lịch sử/copy được đánh dấu candidate-visible.
- Recruiter note nội bộ, lý do nhạy cảm, điểm AI chi tiết hoặc dữ liệu của actor nội bộ không được rò rỉ qua Candidate API.
- Application vẫn phải xem được khi job đã đóng, hết hạn hoặc không còn công khai.
- Mọi thay đổi stage phải có một nguồn dữ liệu, một policy chuyển trạng thái và một audit trail thống nhất.

## 3. Kết quả rà soát hiện trạng

### 3.1. Những phần đã đúng

| Khu vực         | Hiện trạng đúng                                  | Ý nghĩa                                                  |
| --------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Prisma schema   | `ApplicationStage` đã có đủ 9 giá trị canonical  | Không cần thay enum chỉ để đổi tên UI                    |
| Job application | `JobApplication.stage` mặc định là `APPLIED`     | Submission service đã khởi tạo đúng stage                |
| Submission      | Repository tạo application trong database        | Có nền tảng để chuyển Applied Jobs sang nguồn chính thức |
| Vision/spec     | Phân tách recruitment stage và AI scoring status | Có ranh giới nghiệp vụ rõ để chuẩn hóa                   |

### 3.2. Những điểm không nhất quán

| Mức độ | Vấn đề                                          | Bằng chứng hiện tại                                                                                             | Hệ quả                                                                |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P0     | Applied Jobs không đọc application từ database  | `web/src/app/jobs/applied/page.tsx` gọi `readJobWorkspaceSnapshot()`, sau đó đọc `user-job-state.json`          | Trạng thái có thể sai hoặc mất khi đổi môi trường/container           |
| P0     | Có hai lần ghi sau submission                   | DB ghi `APPLIED`; `apply-form-section.tsx`/`job-interaction-provider.tsx` tiếp tục ghi local status `submitted` | Hai nguồn dễ lệch, retry khó kiểm soát                                |
| P0     | Bộ trạng thái UI không canonical                | `preferences.ts` dùng `submitted`, `screening`, `considering`, `matched`, `not_fit`                             | Không đáp ứng Vision và không thể đồng bộ recruiter pipeline          |
| P0     | JSON được track có application/contact snapshot | `web/data/jobs/user-job-state.json`                                                                             | Rủi ro PII, fixture lẫn với state runtime và không phù hợp production |
| P1     | Chưa có bảng lịch sử stage bất biến             | Prisma chưa có model application stage event/history                                                            | Candidate không thể xem timeline đáng tin cậy; audit yếu              |
| P1     | Chưa có transition service dùng chung           | Chưa có policy/API cập nhật recruitment stage hoàn chỉnh                                                        | Recruiter UI và Candidate UI không thể đồng bộ an toàn                |
| P1     | Chưa có stage-change notification               | Notification kind hiện chủ yếu phục vụ submitted/received                                                       | Không đáp ứng mục tiêu minh bạch trạng thái                           |
| P1     | UI Applied chỉ có tabs/card đơn giản            | `applied-jobs-page.tsx` render bộ tab cũ và badge gần như cùng phong cách                                       | Khó quét, khó hiểu bước tiếp theo, chưa có history/detail             |
| P1     | Test bảo vệ mô hình cũ                          | Một số fixture dùng `status: "submitted"`; E2E chưa kiểm tra Applied tracking                                   | Dễ tái phát sau khi đổi UI                                            |
| P2     | Prototype/tài liệu phụ còn tên cũ               | Prototype Candidate Job Journey và một số proposal cũ dùng Submitted/In review/Not selected                     | Thiết kế và code có thể tiếp tục phát sinh taxonomy khác              |

### 3.3. Nguyên nhân gốc

Luồng hiện tại có dạng:

```text
Submit application
    ├─> Database: JobApplication.stage = APPLIED       (nguồn chính xác)
    └─> Local JSON: AppliedJobState.status = submitted (nguồn Applied Jobs đang đọc)
```

Luồng mục tiêu:

```text
Candidate submission
    -> transaction: JobApplication(APPLIED) + initial stage event + outbox
    -> Candidate application query đọc database
    -> Applied Jobs/My applications hiển thị APPLIED

Recruiter stage update
    -> validate quyền + transition + expected version
    -> transaction: update current stage + append event + audit/outbox
    -> Candidate query và recruiter pipeline cùng thấy một kết quả
    -> notification được gửi sau commit
```

## 4. Mô hình trạng thái canonical

### 4.1. Tên hiển thị và ngữ nghĩa

| Giá trị domain   | Candidate label | Nhóm UX            | Ý nghĩa ngắn                               | Hướng hiển thị đề xuất                              |
| ---------------- | --------------- | ------------------ | ------------------------------------------ | --------------------------------------------------- |
| `APPLIED`        | Applied         | Active             | Hồ sơ đã được gửi thành công               | Xanh dương trung tính; “Application received”       |
| `VIEWED`         | Viewed          | Active             | Recruiter có quyền đã mở hồ sơ lần đầu     | Cyan/info; không hứa rằng hồ sơ đã được đánh giá    |
| `SHORTLISTED`    | Shortlisted     | Active             | Hồ sơ được đưa vào danh sách cân nhắc tiếp | Indigo; copy tích cực nhưng không bảo đảm phỏng vấn |
| `INTERVIEWING`   | Interviewing    | Active             | Quy trình phỏng vấn đang diễn ra           | Violet; ưu tiên hiển thị next step nếu có           |
| `OFFERED`        | Offered         | Needs attention    | Nhà tuyển dụng đã đưa ra offer             | Amber; CTA nổi bật, không chỉ dựa vào màu           |
| `HIRED`          | Hired           | Completed-positive | Ứng viên đã được tuyển                     | Green/success                                       |
| `OFFER_DECLINED` | Offer declined  | Completed-neutral  | Offer đã bị ứng viên từ chối               | Orange/slate; copy trung tính                       |
| `REJECTED`       | Rejected        | Completed-negative | Quy trình đã kết thúc do không tiếp tục    | Red có tiết chế; copy tôn trọng, không gây phán xét |
| `WAITLISTED`     | Waitlisted      | Paused             | Hồ sơ tạm chờ và có thể được xem xét lại   | Teal/slate; không thể hiện như terminal             |

Màu cụ thể phải dùng semantic design tokens của hệ thống, không hard-code màu riêng trong component. Badge luôn có text và icon/shape phù hợp; màu không được là tín hiệu duy nhất.

### 4.2. Policy chuyển stage đề xuất

Policy cần được định nghĩa ở một module domain dùng chung, không nằm rải rác trong drag-and-drop handler hoặc component:

- Dãy active theo thứ tự nghiệp vụ: `APPLIED -> VIEWED -> SHORTLISTED -> INTERVIEWING -> OFFERED`.
- Cho phép bỏ qua bước active khi đó là hành động thật, ví dụ `APPLIED -> SHORTLISTED`; không sinh event trung gian giả.
- Từ mọi active stage có thể chuyển sang `REJECTED` hoặc `WAITLISTED` nếu người dùng có quyền và cung cấp dữ liệu bắt buộc theo policy.
- `OFFERED` có thể chuyển sang `HIRED`, `OFFER_DECLINED` hoặc `REJECTED` nếu offer bị rút.
- `WAITLISTED` có thể quay lại một active stage phù hợp hoặc chuyển `REJECTED`.
- `HIRED`, `OFFER_DECLINED`, `REJECTED` là terminal trong thao tác thông thường.
- Sửa sai/reopen terminal stage phải là action riêng dành cho role được phép, bắt buộc reason và audit; không dùng drag-and-drop thông thường.
- `VIEWED` chỉ được tạo từ hành động thật của recruiter được phép khi mở application lần đầu. Candidate tự mở hồ sơ hoặc background job không được tạo `VIEWED`.
- Transition lặp lại cùng target stage phải idempotent hoặc trả kết quả rõ ràng, không tạo event trùng.

Policy cuối cùng cần được Product/BA xác nhận trước khi mở quyền recruiter update, nhưng việc Candidate đọc đúng current stage không cần chờ toàn bộ Kanban hoàn tất.

### 4.3. Những mapping không được làm tự động

| Status cũ     | Xử lý đề xuất                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `submitted`   | Không duy trì như stage. UI submission vẫn có thể báo “Application submitted”; current stage đọc từ DB là `APPLIED`. |
| `viewed`      | Có vẻ tương đương `VIEWED`, nhưng không import từ local JSON nếu không có bằng chứng recruiter đã xem.               |
| `screening`   | Không tự map sang `VIEWED` hoặc `SHORTLISTED`; khái niệm mơ hồ và có thể là AI processing.                           |
| `considering` | Không tự map sang `SHORTLISTED` hoặc `WAITLISTED`; cần nguồn authoritative.                                          |
| `matched`     | Đây là kết quả matching, không phải recruitment stage. Chuyển sang domain recommendation/matching nếu còn cần.       |
| `not_fit`     | Không tự map sang `REJECTED`; đây có thể là AI/recommendation result, không phải quyết định recruiter.               |

Nguyên tắc migration: ưu tiên application trong database. Local application mirror không được dùng để nâng cấp hoặc hạ stage chính thức.

## 5. Thiết kế trải nghiệm Candidate mục tiêu

### 5.1. Kiến trúc thông tin

- Giữ route `/jobs/applied` để không làm hỏng bookmark và navigation hiện tại.
- Có thể giữ nhãn tab ngắn “Applied” trong Jobs workspace, nhưng heading trang nên là “My applications” để tránh nhầm giữa tên trang và stage `Applied`.
- Header gồm tiêu đề, mô tả ngắn và tổng số application; không dùng dashboard metrics nặng nếu chưa có giá trị rõ ràng.
- Bộ lọc cấp một gồm `All`, `Active`, `Needs attention`, `Completed`; thêm stage filter dạng accessible select/popover để lọc chính xác cả 9 stage.
- Không ép 9 stage thành 9 tab ngang trên mobile vì gây cuộn ngang và giảm khả năng quét.
- Sort mặc định theo `lastStageChangedAt DESC`, có lựa chọn “Recently applied” nếu cần.
- URL giữ filter/sort để back/forward, refresh và deep-link hoạt động ổn định.

### 5.2. Application card

Mỗi card cần có:

- Job title và company snapshot tại thời điểm apply; link sang job hiện tại chỉ khi job còn khả dụng.
- Canonical stage badge, `submittedAt`, thời điểm cập nhật stage gần nhất.
- Một dòng giải thích “What happens next” theo stage, chỉ dùng copy đã được duyệt; không hứa deadline không tồn tại.
- CTA chính “View application” mở detail/history.
- Thông tin location/work mode tối thiểu nếu có snapshot đáng tin cậy.
- Nếu job không còn public: giữ nguyên card, hiển thị “This job is no longer available”, vẫn cho xem application và history.
- Nếu hiển thị Application ID phải dùng `application.id`, không gắn nhãn Application ID cho `jobId`.
- AI scoring, nếu xuất hiện, nằm trong khu vực riêng với nhãn “CV analysis”/“Scoring status”; không dùng cùng badge hoặc timeline với recruitment stage.

Không nên dùng progress percentage kiểu 60% vì pipeline có nhánh `WAITLISTED`, `REJECTED`, `OFFER_DECLINED` và có thể bỏ qua stage. Thay vào đó, card chỉ hiển thị current stage; detail dùng timeline event thực tế.

### 5.3. Application detail và timeline

Detail view cần gồm:

1. Current stage hero: badge, job/company, submitted date, last updated.
2. Candidate-visible timeline theo thứ tự mới nhất hoặc chronological có quy ước rõ ràng.
3. Submitted application snapshot: CV/file reference an toàn, cover note và các câu trả lời được phép xem lại.
4. Next step/context theo stage.
5. Trạng thái job hiện tại: open/closed/unavailable nhưng không làm mất application record.

Timeline chỉ render event có `candidateVisible = true` hoặc event type mặc định an toàn. Không trả raw internal note rồi ẩn bằng CSS. Candidate-facing reason cần là trường riêng, đã sanitize và có giới hạn độ dài.

### 5.4. Loading, empty và error states

- Initial loading: skeleton có kích thước gần với card thật để tránh layout shift.
- Filter loading: giữ danh sách cũ hoặc skeleton cục bộ; không làm toàn trang nhấp nháy.
- Empty all: giải thích chưa có application và CTA “Browse jobs”.
- Empty filtered: “No applications in this stage” và action xóa filter.
- Unauthorized: chuyển về sign-in theo convention hiện tại, không leak dữ liệu.
- Server/network error: message dễ hiểu, nút Retry và request correlation ID chỉ khi phù hợp hỗ trợ.
- Stale detail/deleted job: vẫn render application snapshot; không biến thành 404 chỉ vì job public không còn tồn tại.

### 5.5. Responsive, accessibility và visual quality

- Bảo đảm hoạt động từ viewport 320 px; filter chuyển thành popover/select, card không có horizontal overflow.
- Desktop dùng mật độ vừa phải, ưu tiên scan stage/title/company; không nhồi toàn bộ application payload lên card.
- Focus order theo thứ tự thị giác; mọi button/link có focus-visible rõ ràng.
- Current filter dùng `aria-current` hoặc trạng thái selected đúng semantic.
- Stage update live chỉ announce qua vùng `aria-live="polite"` khi thay đổi thật, không announce khi initial render.
- Icon trang trí dùng `aria-hidden`; badge có text đầy đủ.
- Contrast đạt WCAG AA; hỗ trợ `prefers-reduced-motion` cho transition/skeleton.
- Không dùng animation celebratory bắt buộc; `Hired` có thể có visual tích cực nhẹ nhưng phải tôn trọng reduced motion.
- Copy cho `Rejected` và `Offer declined` trung tính, tôn trọng và không suy diễn nguyên nhân.

## 6. Thiết kế dữ liệu và backend

### 6.1. Nguồn sự thật duy nhất

`JobApplication` trong database là authoritative cho:

- ownership;
- current recruitment stage;
- submitted timestamp;
- application snapshot;
- candidate/job/company relationship;
- AI consent và scoring reference/status nếu thuộc application.

`web/data/jobs/user-job-state.json` chỉ có thể tiếp tục phục vụ fixture/demo cho saved/hidden/preference trong non-production nếu thật sự cần. Nó không được chứa application stage, contact snapshot hoặc CV reference runtime.

### 6.2. Application stage history

Thêm model append-only, tên đề xuất `ApplicationStageEvent`:

| Trường                   | Mục đích                                                   |
| ------------------------ | ---------------------------------------------------------- |
| `id`                     | Stable event ID                                            |
| `applicationId`          | Liên kết application                                       |
| `fromStage`              | Nullable cho event khởi tạo                                |
| `toStage`                | Canonical destination stage                                |
| `actorUserId`            | User thực hiện nếu có                                      |
| `actorType`              | Candidate/Recruiter/SystemMigration; giới hạn enum rõ ràng |
| `reasonCode`             | Mã lý do có cấu trúc nếu transition bắt buộc               |
| `candidateVisibleReason` | Copy đã kiểm soát; không dùng internal note                |
| `candidateVisible`       | Quyền hiển thị event                                       |
| `occurredAt`             | Thời điểm domain event xảy ra                              |
| `applicationVersion`     | Version sau transition, phục vụ audit/idempotency          |
| `metadata`               | Chỉ cho metadata đã allowlist; không chứa PII tùy ý        |

Ràng buộc/index đề xuất:

- Index `(applicationId, occurredAt, id)` cho timeline ổn định.
- Unique phù hợp cho idempotency key hoặc `(applicationId, applicationVersion)`.
- Không hỗ trợ update/delete event qua application service thông thường.
- Bổ sung `stageVersion` và `lastStageChangedAt` trên `JobApplication`; `stageVersion` tăng trong cùng transaction.
- Initial event `null -> APPLIED` được tạo cùng transaction với application submission.

### 6.3. Transition service

Tạo một application-stage service dùng cho mọi UI/API:

1. Load application, company scope và current version.
2. Kiểm tra actor membership/role và quyền trên job/application.
3. Validate target stage bằng transition policy trung tâm.
4. Validate reason/candidate-visible content theo target stage.
5. So sánh `expectedVersion`; trả conflict nếu dữ liệu đã cũ.
6. Trong một transaction: update current stage/version, append event, ghi audit và outbox.
7. Sau commit, worker xử lý notification idempotently.

Không cập nhật optimistic UI thành công vĩnh viễn trước server acknowledgement. Kanban có thể phản hồi thị giác nhanh nhưng phải rollback card và báo conflict nếu transaction thất bại.

### 6.4. Candidate read model/API

Đề xuất contract dùng chung cho server component và API:

- `GET /api/candidate/applications?group=&stage=&cursor=&sort=`
- `GET /api/candidate/applications/{applicationId}`

Yêu cầu:

- Derive candidate identity từ authenticated session; không nhận `candidateId` tùy ý từ client.
- Query luôn có ownership predicate ở repository, không load rồi lọc trong memory.
- Dùng cursor pagination và deterministic order.
- Chỉ chọn trường cần thiết; không serialize recruiter note hoặc internal scoring payload.
- Response có canonical stage schema, stage label có thể format ở presentation layer.
- Set cache policy phù hợp dữ liệu cá nhân (`private`, `no-store` hoặc dynamic theo convention hiện tại).
- Application view model ưu tiên snapshot lúc apply; nối current public job projection chỉ để tạo link/trạng thái availability.
- Detail history chỉ trả candidate-visible events.

Nếu page là server component và không cần browser fetch, có thể gọi query service trực tiếp để tránh self-HTTP; API vẫn hữu ích cho refresh/client interaction. Cả hai phải dùng cùng repository/query mapper và shared schema.

### 6.5. Recruiter write/read contract

Để toàn bộ pipeline đồng bộ, bổ sung hoặc chuẩn hóa:

- Query applications theo company/job/stage cho Kanban.
- Command transition nhận `targetStage`, `expectedVersion`, optional `reasonCode`, optional candidate-safe message và idempotency key.
- Trả application stage/version/event mới sau commit.
- `409 Conflict` cho stale version, kèm current safe stage/version để client refresh.
- `422` cho transition không hợp lệ, `403` cho thiếu quyền, `404` dùng theo policy chống enumeration.
- Drag-and-drop và detail action đều gọi cùng transition service.

### 6.6. Notification và audit

- Mở rộng notification kind cho stage change hoặc dùng một kind có payload canonical được version hóa.
- Tạo outbox trong cùng transaction với stage event; chỉ gửi email/in-app notification sau commit.
- Dedupe theo event ID để retry không gửi nhiều email.
- Template theo canonical stage, với copy an toàn và deep-link về application detail.
- `VIEWED` có thể không gửi email nếu Product đánh giá gây nhiễu; dù vậy UI vẫn phải cập nhật. Quy tắc notification phải là cấu hình rõ, không hard-code rải rác.
- Log/audit gồm application ID, company ID, from/to stage, actor ID, event/version; không log CV content, contact snapshot hoặc reason tự do chưa redact.

## 7. Kế hoạch migration và xử lý dữ liệu cũ

### 7.1. Database migration

1. Tạo `ApplicationStageEvent`, `stageVersion`, `lastStageChangedAt` và các index.
2. Backfill mỗi application hiện có một event khởi tạo `null -> currentStage`:
   - Nếu current stage là `APPLIED`, dùng `submittedAt` làm `occurredAt`.
   - Nếu application đã có stage khác từ dữ liệu hợp lệ, event được đánh dấu `SystemMigration` và metadata nêu đây là snapshot migration, không giả lập toàn bộ lịch sử.
3. Đặt `stageVersion` ban đầu nhất quán với event backfill.
4. Chạy kiểm tra số lượng: mọi application có đúng current event/version tương ứng.
5. Chỉ sau khi backfill và query mới ổn định mới chuyển Applied page sang nguồn database.

Migration phải có script kiểm chứng/idempotent hoặc migration transaction phù hợp quy mô dữ liệu. Không tự import status mơ hồ từ local JSON.

### 7.2. Loại bỏ application mirror

- Xóa action `apply` khỏi `/api/jobs/user-state` sau khi Applied Jobs đã chuyển sang DB.
- Xóa `AppliedJobState.status`, contact snapshot và CV reference khỏi local user-state contract.
- Gỡ lần ghi local sau submission trong `apply-form-section.tsx`/`job-interaction-provider.tsx`.
- Sanitize `web/data/jobs/user-job-state.json`; không để PII/application runtime trong file tracked.
- Nếu saved/hidden/preferences vẫn cần persistence giả lập, chuyển fixture về dữ liệu vô danh và runtime state sang file `.local` đã gitignore hoặc persistence chính thức.
- Thêm guard/test để production không phụ thuộc file local writable; Docker container restart không được làm mất Applied applications.

### 7.3. Chiến lược tương thích

- Backend/shared contracts triển khai trước frontend để response canonical luôn sẵn sàng.
- Trong một release ngắn có thể giữ parser đọc status cũ chỉ cho fixture test, nhưng không expose ra UI và phải có ngày xóa cụ thể.
- Không duy trì dual-write DB + JSON trong giai đoạn chuyển đổi; dual-read có thời hạn cũng chỉ dùng để so sánh telemetry, không chọn JSON làm fallback authoritative.
- Route `/jobs/applied` được giữ nguyên nên không cần redirect migration.

## 8. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 0 — Chốt contract và baseline

**Mục tiêu:** khóa ngữ nghĩa trước khi sửa code.

- Xác nhận 9 stage, candidate labels, stage grouping và transition policy.
- Xác nhận stage nào gửi notification và candidate-visible reason policy.
- Chụp baseline UI ở desktop/mobile; ghi lại test hiện có và dữ liệu fixture.
- Thêm characterization tests cho submission hiện tại: application DB được tạo ở `APPLIED` và action result vẫn là “submitted successfully”.
- Lập inventory mọi literal/status cũ bằng `rg` trên source, tests, seed, docs và prototype.

**Điều kiện ra:** có shared decision table được duyệt; không còn câu hỏi có thể làm đổi schema hoặc quyền truy cập.

### Giai đoạn 1 — Chuẩn hóa shared contracts và presentation model

**Mục tiêu:** một taxonomy trong code.

- Tạo canonical `applicationStageSchema`/type/labels/grouping ở shared contract.
- Không dùng type preference/user-state để biểu diễn recruitment stage.
- Tách rõ `submissionOutcome`, `recruitmentStage`, `scoringStatus`, `matchResult`.
- Tạo formatter/copy map tập trung cho badge, next-step message và accessibility label.
- Deprecate rồi xóa `submitted`, `screening`, `considering`, `matched`, `not_fit` khỏi Applied UI contract.
- Cập nhật fixture/test compiler errors để phát hiện nơi còn dùng status cũ.

**Phụ thuộc:** Giai đoạn 0.  
**Điều kiện ra:** tìm kiếm source không còn dùng taxonomy cũ như recruitment stage ngoài migration/legacy test có chú thích.

### Giai đoạn 2 — Bổ sung history, versioning và migration

**Mục tiêu:** có nền tảng dữ liệu an toàn trước khi làm timeline/Kanban.

- Thêm Prisma model/fields/index và migration.
- Sửa submission transaction để tạo initial stage event.
- Viết backfill và consistency check cho application hiện có.
- Bổ sung repository methods đọc current stage/history.
- Test transaction rollback: nếu event/outbox lỗi thì application/stage không được ghi nửa vời.

**Phụ thuộc:** Giai đoạn 1.  
**Điều kiện ra:** mọi application có current stage và event/version nhất quán; migration test pass trên snapshot dữ liệu đại diện.

### Giai đoạn 3 — Chuyển Candidate Applied Jobs sang database

**Mục tiêu:** loại bỏ nguyên nhân hiển thị sai và khác biệt Docker.

- Tạo candidate-owned application query/list/detail service.
- Chuyển `web/src/app/jobs/applied/page.tsx` khỏi `readJobWorkspaceSnapshot()` cho dữ liệu application.
- Dùng snapshot job/company để application vẫn hiển thị khi job unavailable.
- Thêm pagination/filter/sort canonical.
- Gỡ local apply write và action API tương ứng.
- Sanitize tracked JSON, xóa PII/application state.
- Xác minh container restart không làm mất application đã submit.

**Phụ thuộc:** Giai đoạn 2.  
**Điều kiện ra:** submission vừa tạo xuất hiện trên `/jobs/applied` ở stage `Applied` chỉ từ DB; không có application dual-write.

### Giai đoạn 4 — Transition service, recruiter sync và notification

**Mục tiêu:** current stage có thể thay đổi đúng quy trình và phản ánh end-to-end.

- Hiện thực central transition policy và authorization.
- Thêm optimistic concurrency/version conflict handling.
- Nối Kanban/detail recruiter vào cùng command service.
- Tạo stage event, audit và outbox atomically.
- Bổ sung notification templates/dedupe/retry.
- Cập nhật candidate cache/revalidation hoặc refresh strategy để trạng thái mới xuất hiện kịp thời.

**Phụ thuộc:** Giai đoạn 2; có thể song song một phần với UI của Giai đoạn 3.  
**Điều kiện ra:** recruiter đổi stage một lần tạo đúng một history event; Candidate thấy cùng stage; stale update không ghi đè im lặng.

### Giai đoạn 5 — Hoàn thiện UI/UX My applications

**Mục tiêu:** trải nghiệm theo dõi rõ ràng, đẹp và accessible.

- Đổi heading thành “My applications”, giữ route/navigation tương thích.
- Xây stage badge semantic và filter groups.
- Cải tiến card theo mô tả ở mục 5.2.
- Thêm detail/timeline candidate-visible.
- Hoàn thiện empty/loading/error/unavailable-job states.
- Responsive QA ở 320/375/768/1024/1440 px, light/dark theme nếu workspace hỗ trợ.
- Accessibility audit bàn phím, screen reader, contrast và reduced motion.

**Phụ thuộc:** Giai đoạn 3; timeline đầy đủ cần Giai đoạn 2.  
**Điều kiện ra:** UI không còn label cũ, không có overflow, stage có thể hiểu không cần dựa vào màu.

### Giai đoạn 6 — Tài liệu, test hồi quy và rollout

**Mục tiêu:** ngăn taxonomy cũ quay lại và triển khai an toàn.

- Cập nhật prototype/spec phụ đang dùng Submitted/In review/Not selected nếu chúng còn là tài liệu active.
- Đánh dấu proposal/report lịch sử là non-normative thay vì sửa lại nội dung nghiên cứu cũ không cần thiết.
- Chạy unit, integration, contract, component, E2E, accessibility và migration tests.
- Rollout backend/migration trước, UI sau; theo dõi error/conflict/notification metrics.
- Xóa compatibility code sau thời hạn đã định.

**Phụ thuộc:** Giai đoạn 1–5.  
**Điều kiện ra:** đạt toàn bộ Definition of Done ở mục 13.

## 9. Ma trận file/khu vực dự kiến thay đổi

Danh sách dưới đây là phạm vi dự kiến; tên file mới có thể điều chỉnh theo convention thực tế khi triển khai.

| Khu vực            | File hiện có/đề xuất                                                                  | Thay đổi chính                                                                     |
| ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Canonical contract | `web/src/shared/contracts/jobs/preferences.ts`                                        | Gỡ application status cũ khỏi preference contract                                  |
| Canonical contract | `web/src/shared/contracts/jobs/catalog.ts`                                            | Gỡ `AppliedJobState` làm application source; tách match/scoring khỏi stage         |
| Canonical contract | Đề xuất `web/src/shared/contracts/jobs/applications.ts`                               | Schema/type/labels/groups/API DTO canonical                                        |
| Prisma             | `web/prisma/schema.prisma`                                                            | Stage event, version, last changed time, notification kind/outbox relation nếu cần |
| Migration          | `web/prisma/migrations/...`                                                           | Additive schema và backfill                                                        |
| Submission         | `web/src/backend/services/jobs/job-application-service.ts`                            | Initial event/outbox transaction                                                   |
| Repository         | `web/src/backend/repositories/jobs/prisma-job-application-repository.ts`              | Candidate list/detail/history và transactional write support                       |
| Stage service      | Đề xuất module trong `web/src/backend/services/jobs/`                                 | Policy, authorization, concurrency, audit/outbox                                   |
| Candidate route    | `web/src/app/jobs/applied/page.tsx`                                                   | Đọc DB query thay workspace JSON snapshot                                          |
| Candidate API      | Đề xuất `web/src/app/api/candidate/applications/...`                                  | Owned list/detail canonical                                                        |
| Applied UI         | `web/src/frontend/features/jobs/components/applied-jobs-page.tsx`                     | Filter/card/detail entry point mới                                                 |
| Applied styling    | `web/src/frontend/features/jobs/styles/job-board.css` hoặc CSS module theo convention | Semantic badge, layout, responsive, states                                         |
| Submission UI      | `web/src/frontend/features/jobs/components/apply-form-section.tsx`                    | Gỡ local application mirror write                                                  |
| Client state       | `web/src/frontend/features/jobs/components/job-interaction-provider.tsx`              | Không patch action `apply` vào user-state JSON                                     |
| Legacy local API   | `web/src/app/api/jobs/user-state/route.ts`                                            | Xóa action/application payload; giữ saved/hidden nếu cần                           |
| Legacy store       | `web/src/backend/services/jobs/user-job-state-store.ts`                               | Không lưu application/PII; giới hạn non-production                                 |
| Legacy data        | `web/data/jobs/user-job-state.json`                                                   | Sanitize và gỡ application records                                                 |
| Notification       | Notification schema/service/worker hiện có                                            | Stage event templates, outbox, dedupe                                              |
| Tests              | `web/tests/frontend/components/jobs/...`                                              | Canonical fixtures, filters, card/timeline/a11y                                    |
| E2E                | `web/tests/system/e2e/job-board/...`                                                  | Submit -> Applied -> recruiter transition -> Candidate update                      |
| Docs/prototypes    | Vision-linked use cases/prototypes active                                             | Đồng bộ nhãn và timeline; đánh dấu tài liệu lịch sử                                |

## 10. Chiến lược kiểm thử

### 10.1. Unit tests

- Parse/serialize đủ 9 stage; reject status cũ ở canonical API.
- Stage grouping và label map đầy đủ, không có fallback im lặng.
- Transition policy: forward, skip, waitlist return, terminal rejection và privileged correction.
- Candidate-safe event mapper không xuất internal note/actor details.
- Next-step copy và accessibility label có giá trị cho mọi stage.

### 10.2. Repository/integration tests

- Candidate chỉ query được application của mình.
- Company recruiter chỉ query/update trong scope được cấp quyền.
- Submission tạo `JobApplication(APPLIED)` và đúng một initial event.
- Transition update stage/version và append event trong cùng transaction.
- Hai request cùng `expectedVersion`: một thành công, một trả conflict.
- Retry cùng idempotency key không tạo event/notification trùng.
- Job closed/deleted-public vẫn trả application snapshot.
- Timeline sort ổn định khi hai event có timestamp gần nhau.
- Migration backfill idempotent và current stage khớp event mới nhất.

### 10.3. Component tests

- Render đúng badge/copy cho cả 9 stage.
- Group filter và exact stage filter hoạt động, sync URL.
- Empty/loading/error/unavailable-job states.
- Card dùng application ID đúng.
- Không render recruiter-only reason hoặc raw scoring payload.
- Keyboard navigation, focus-visible, aria selected/current và live region.
- 320 px không overflow ngang.

### 10.4. End-to-end scenarios bắt buộc

1. Candidate submit job thành công; toast dùng ngôn ngữ submission; `/jobs/applied` hiển thị stage `Applied`.
2. Restart Docker/app; application vẫn tồn tại vì đọc database.
3. Recruiter mở application lần đầu; tạo một `Viewed` event; mở lại không tạo event trùng.
4. Recruiter chuyển `Viewed -> Shortlisted`; Candidate refresh và thấy stage/timeline mới.
5. AI scoring chuyển `Pending -> Completed`; recruitment stage không đổi.
6. Recruiter chuyển sang `Offered`; notification được gửi một lần và Candidate thấy trạng thái cần chú ý.
7. Một client dùng version cũ cập nhật; nhận conflict và UI phục hồi đúng.
8. Candidate A không thể truy cập application của Candidate B bằng đổi URL/ID.
9. Job đóng hoặc bị ẩn; Candidate vẫn xem được application/history.
10. Recruiter note nội bộ không xuất hiện trong response hoặc DOM Candidate.

### 10.5. Non-functional tests

- Security review cho IDOR, tenant isolation, mass assignment và log redaction.
- Accessibility audit tự động và thủ công.
- Query plan/index kiểm tra trên dữ liệu có quy mô đại diện; tránh N+1 job/company/history.
- Notification retry/dedupe test.
- Load test list pagination và Kanban transition theo mục tiêu performance của Vision; đặc biệt visual feedback nhanh và persistence P95 không vượt yêu cầu đã nêu cho Kanban.

## 11. Rollout, observability và rollback

### 11.1. Thứ tự rollout

1. Additive DB migration + backfill + consistency checks.
2. Backend read contracts/repository và telemetry.
3. Submission initial event và transition service.
4. Candidate Applied UI đọc DB.
5. Recruiter transition/notification.
6. Xóa local application mirror và compatibility code.

Nếu cần feature flag, flag nên điều khiển UI/query path mới, không điều khiển việc ghi hai nguồn lâu dài.

### 11.2. Metrics/logs cần theo dõi

- Candidate application list/detail error rate và latency.
- Số application thiếu stage event hoặc current stage lệch latest event; mục tiêu bằng 0.
- Transition success, invalid transition, authorization failure và version conflict rate.
- Outbox lag, notification retry/failure/dedupe count.
- Số lần code legacy user-state `apply` được gọi sau cutover; mục tiêu giảm về 0 trước khi xóa.
- Không đưa CV/contact/reason tự do vào metrics labels hoặc logs.

### 11.3. Rollback

- Schema/history migration là additive; không xóa bảng/event khi rollback UI.
- Có thể quay Candidate UI về phiên bản đọc DB trước đó, nhưng không quay lại JSON application mirror.
- Nếu notification lỗi, dừng consumer/template bị lỗi; giữ event/outbox để retry sau.
- Nếu transition UI lỗi, tạm khóa write endpoint bằng feature flag nhưng vẫn cho Candidate đọc current stage/history.

## 12. Rủi ro và quyết định khuyến nghị

| Rủi ro/quyết định                             | Khuyến nghị                                                             |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| Chỉ đổi nhãn UI, không đổi data source        | Không thực hiện; sẽ che lỗi thay vì sửa nguyên nhân gốc                 |
| Map status local mơ hồ sang canonical         | Không tự động; DB là authoritative                                      |
| 9 tab ngang gây nặng UI/mobile                | Dùng 4 nhóm chính + exact stage filter                                  |
| Progress bar tạo cảm giác pipeline tuyến tính | Dùng current-stage badge + event timeline thực tế                       |
| `Viewed` bị tạo bởi automation                | Chỉ ghi khi recruiter được phép thực sự mở application lần đầu          |
| AI “matched/not fit” tác động stage           | Giữ hoàn toàn trong scoring/matching domain                             |
| Candidate thấy reason nội bộ                  | Dùng trường candidate-safe riêng và allowlist ở mapper/API              |
| Concurrent Kanban updates ghi đè              | `stageVersion` + expected version + `409 Conflict`                      |
| Notification gửi trước transaction commit     | Transactional outbox và idempotent consumer                             |
| Job bị xóa làm mất context                    | Dùng immutable job/company snapshot trong application                   |
| PII còn trong tracked fixture                 | Sanitize ngay trong giai đoạn cutover và thêm guard/test                |
| Tài liệu cũ tiếp tục gây hiểu nhầm            | Vision là normative; cập nhật prototype active, đánh dấu report lịch sử |

## 13. Definition of Done

Thay đổi chỉ được xem là hoàn tất khi đáp ứng toàn bộ điều kiện sau:

- [ ] Mọi Candidate/Recruiter API và UI chỉ dùng 9 recruitment stages canonical.
- [ ] `Submitted`, `screening`, `considering`, `matched`, `not_fit` không còn được dùng như recruitment stage.
- [ ] `/jobs/applied` đọc application từ database và không phụ thuộc local JSON.
- [ ] Submission tạo `APPLIED` và initial stage event trong một transaction.
- [ ] Mọi stage update hợp lệ tạo đúng một immutable event, audit/outbox và tăng version.
- [ ] Stale concurrent update không ghi đè im lặng.
- [ ] Candidate chỉ xem được application/history candidate-visible của chính mình.
- [ ] AI scoring/matching thay đổi không làm đổi recruitment stage.
- [ ] Application vẫn xem được khi job không còn public.
- [ ] UI có filter, card, detail/timeline, loading/empty/error states hoàn chỉnh và responsive từ 320 px.
- [ ] Stage badge đạt contrast, có text và không phụ thuộc màu; keyboard/screen reader hoạt động.
- [ ] Notification stage change idempotent, chỉ gửi sau commit và không lộ dữ liệu nội bộ.
- [ ] Tracked JSON không chứa application runtime, contact snapshot hoặc CV reference nhạy cảm.
- [ ] Unit, integration, component, E2E, security, accessibility và migration tests liên quan đều pass.
- [ ] Prototype/tài liệu active không còn mâu thuẫn với Vision; tài liệu lịch sử được đánh dấu rõ.
- [ ] Có telemetry và quy trình rollback không quay lại dual-write/local application mirror.

## 14. Thứ tự ưu tiên khuyến nghị

Nếu cần chia nhỏ thành các pull request độc lập, thứ tự tối ưu là:

1. **PR 1 — Canonical contracts và characterization tests.**
2. **PR 2 — Stage history/version migration và submission initial event.**
3. **PR 3 — Candidate application query + chuyển Applied page sang DB + loại bỏ dual-write.**
4. **PR 4 — My applications card/filter/detail/timeline và accessibility.**
5. **PR 5 — Recruiter transition service/Kanban synchronization.**
6. **PR 6 — Notification, observability, legacy cleanup và docs/prototypes.**

Mỗi PR phải giữ build/test xanh và không đưa trở lại một nguồn trạng thái thứ hai. PR 3 là mốc sửa trực tiếp lỗi hiện tại; PR 2 là điều kiện dữ liệu để PR 3 và timeline không tạo thêm nợ kỹ thuật.
