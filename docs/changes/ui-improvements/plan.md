# Kế hoạch cải thiện UI: Jobs, CV Import và Preferences

## 1. Mục tiêu và phạm vi

Kế hoạch này được xây dựng từ source UI hiện tại nhằm giải quyết bốn yêu cầu:

1. Bổ sung nút đổi chế độ sáng/tối trên trang Jobs khi người dùng chưa đăng nhập.
2. Tổ chức lại trang Jobs thành vùng đầu trang cố định và hai vùng cuộn độc lập: bộ lọc và danh sách việc làm.
3. Sửa lỗi biên tập và loại bỏ tình trạng trộn tiếng Việt/tiếng Anh trong luồng CV Import.
4. Khôi phục chức năng thay đổi ngôn ngữ trong Preferences và áp dụng ngôn ngữ đã lưu cho workspace.

Phạm vi thực hiện chỉ gồm source ứng dụng và các bài kiểm thử liên quan. Không đọc, sửa, sinh lại hoặc phụ thuộc vào bất kỳ file/thư mục SpecKit nào. Trong giai đoạn lập kế hoạch này không sửa code ứng dụng.

## 2. Kết quả rà soát source hiện tại

### 2.1. Theme ở trang Jobs công khai

- Hạ tầng theme đã tồn tại và hoạt động ở cấp ứng dụng:
  - `web/src/frontend/providers/theme-provider.tsx` quản lý `light`/`dark`, lưu vào `localStorage` với khóa `smarthire-theme` và cập nhật `data-theme` trên thẻ `html`.
  - `web/src/frontend/components/ui/theme-toggle.tsx` là nút chuyển theme dùng chung.
  - `web/src/app/layout.tsx` đã bọc ứng dụng bằng `ThemeProvider`.
- Người dùng đã đăng nhập thấy `ThemeToggle` trong `WorkspaceShell`.
- Header công khai tại `web/src/frontend/features/jobs/components/job-board-header.tsx` chỉ render logo và các liên kết đăng nhập/đăng ký, không render `ThemeToggle`.

Kết luận: không cần tạo cơ chế theme mới; chỉ cần tích hợp component hiện có vào header công khai và điều chỉnh responsive.

### 2.2. Bố cục và hành vi cuộn của Jobs

- `web/src/app/jobs/page.tsx` hiện đặt phần tiêu đề, tab `Find jobs / Verified listings / Transparent details`, bộ lọc và kết quả trong cùng luồng tài liệu.
- `web/src/frontend/features/jobs/styles/job-board.css` đang dùng grid hai cột nhưng chỉ cột bộ lọc có `position: sticky`; danh sách kết quả không có vùng cuộn riêng.
- Với khách chưa đăng nhập, toàn bộ document cuộn bên dưới `JobBoardHeader`.
- Với người đã đăng nhập, `.workspace-main` trong `web/src/frontend/styles/workspace.css` cuộn toàn bộ nội dung Jobs.
- Nếu chỉ thêm `overflow` vào hai cột mà không khống chế chiều cao của chuỗi container cha, vùng cuộn độc lập sẽ không hoạt động ổn định.

Kết luận: cần tạo một layout Jobs theo chiều cao viewport, tách rõ vùng cố định và vùng nội dung còn lại. Cần xử lý cả shell công khai lẫn `WorkspaceShell`, nhưng phải giới hạn thay đổi bằng một biến thể riêng cho route Jobs để không ảnh hưởng Dashboard/Profile.

### 2.3. Ngôn ngữ trong CV Import

- Các route CV Import và hầu hết component/hook đang chứa chuỗi tiếng Anh trực tiếp.
- Một số trạng thái được hiển thị bằng cách biến đổi enum kỹ thuật, ví dụ `replaceAll("_", " ").toLowerCase()`, nên câu chữ không nhất quán và khó dịch chính xác.
- Ngày tháng đang cố định theo `en-US` ở danh sách lịch sử.
- Thông báo xử lý, consent, retry, retention, conflict, review và lỗi mạng nằm rải rác trong nhiều component/hook.
- Có các ký tự cần kiểm tra lại về encoding/biên tập như dấu gạch ngang, dấu ba chấm và dấu check trong nội dung hiển thị.
- CV Import chưa sử dụng `WorkspaceLocale`, trong khi nhiều phần Profile khác đã có nội dung `vi/en`. Vì vậy khi workspace hiển thị tiếng Việt, CV Import vẫn là tiếng Anh và tạo ra giao diện trộn ngôn ngữ.

Kết luận: không nên sửa từng câu rời rạc. Cần tạo một lớp copy/formatter song ngữ dùng chung cho toàn bộ feature CV Import, sau đó thay thế cách render trạng thái kỹ thuật và định dạng ngày trực tiếp.

### 2.4. Language trong Preferences

Backend và contract đã hỗ trợ ngôn ngữ:

- `web/src/shared/contracts/account/preferences.ts` chấp nhận `vi` và `en`.
- `web/src/backend/services/account/account-preferences-service.ts` đã đọc/ghi giá trị ngôn ngữ.
- Prisma đã có `AccountPreferences.language`; không cần migration.
- API `GET/PUT /api/account/preferences` đã hỗ trợ payload ngôn ngữ.

Lỗi nằm ở frontend:

- `WorkspaceLocaleProvider` luôn cung cấp giá trị `"en"`.
- `use-account-preferences.ts` có hàm ép mọi giá trị về tiếng Anh và gửi payload `language: "en"`.
- Select ngôn ngữ trong `account-preferences-form.tsx` bị `disabled`, chỉ có lựa chọn English.
- `WorkspaceShell`, `WorkspaceNavigation`, Preferences và Notification Preferences đang dùng copy tiếng Anh cố định.
- Các test hiện tại còn xác nhận hành vi “English only”, vì vậy phải cập nhật cùng implementation.

Kết luận: khôi phục luồng dữ liệu từ giá trị đã lưu ở database đến `WorkspaceShell`, cho phép chọn `vi/en`, và chỉ đổi ngôn ngữ toàn workspace sau khi lưu thành công.

## 3. Quyết định thiết kế mặc định

### 3.1. Theme công khai

- Tái sử dụng `ThemeToggle`; không tạo state hoặc storage riêng.
- Đặt nút trong nhóm hành động của `JobBoardHeader`, trước `Sign in` và `Create account`.
- Ở màn hình hẹp dùng kiểu compact/icon-only nhưng vẫn giữ `aria-label` và `title` đầy đủ.
- Theme đã chọn tiếp tục được lưu bằng cơ chế hiện có và được giữ khi chuyển giữa trang công khai, đăng nhập và workspace.

### 3.2. Ba vùng của trang Jobs

Trên desktop (`> 980px`), giao diện có cấu trúc:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header của shell: logo/nav hoặc workspace topbar            │  cố định
├──────────────────────────────────────────────────────────────┤
│ Tiêu đề Jobs + Find jobs / Verified / Transparent details   │  cố định
├───────────────────────┬──────────────────────────────────────┤
│ Refine Search         │ Job results                          │
│ cuộn độc lập          │ cuộn độc lập                         │
└───────────────────────┴──────────────────────────────────────┘
```

- Vùng đầu trang gồm toàn bộ nội dung từ thanh tab `Find jobs / Verified listings / Transparent details` trở lên và không di chuyển khi cuộn hai pane bên dưới.
- `Refine Search` và `Job results` nhận phần chiều cao còn lại bằng CSS Grid/Flex với `min-height: 0`.
- Mỗi pane dùng `overflow-y: auto`, `overscroll-behavior: contain` và `scrollbar-gutter: stable`.
- Không chặn sự kiện wheel bằng JavaScript. Trình duyệt tự cuộn pane đang nằm dưới con trỏ, tránh lỗi trackpad, touch và accessibility.
- Pane vẫn phải cuộn được bằng bàn phím/focus, không biến “hover” thành điều kiện duy nhất để sử dụng.
- Ở tablet/mobile (`<= 980px`), quay về một cột và một luồng cuộn tự nhiên của trang; không dùng hai vùng cuộn lồng nhau trên màn hình cảm ứng nhỏ.

### 3.3. Ngôn ngữ workspace

- Database là nguồn dữ liệu chuẩn cho tài khoản đã đăng nhập.
- `getWorkspaceContext()` lấy thêm duy nhất `preferences.language`, với fallback phù hợp nếu bản ghi preferences chưa tồn tại.
- `WorkspaceLocaleProvider` nhận `initialLocale`, quản lý locale hiện tại và cung cấp một action cập nhật locale sau khi lưu.
- Giữ `useWorkspaceLocale()` tương thích với các component hiện có; thêm hook/action riêng để cập nhật locale, tránh sửa không cần thiết hàng loạt consumer.
- Đồng bộ thuộc tính `document.documentElement.lang` và `lang` của workspace khi locale đổi.
- Thay đổi trong select chỉ tạo trạng thái chưa lưu. Toàn workspace chỉ đổi ngôn ngữ sau khi API lưu thành công; nếu lưu thất bại, ngôn ngữ đang dùng không bị đổi.
- Sau khi lưu thành công, cập nhật provider ngay và gọi `router.refresh()` để Server Components nhận ngôn ngữ mới.

### 3.4. Biên tập và dịch CV Import

- Hỗ trợ đầy đủ tiếng Việt và tiếng Anh theo Preferences hiện tại.
- Tạo dictionary có type và các formatter cho trạng thái, giai đoạn, field label, action, lỗi đã biết, ngày/giờ và số lượng.
- Không hiển thị enum/status kỹ thuật bằng phép `lowercase`; mọi trạng thái phải có nhãn biên tập rõ ràng.
- Chuẩn hóa thuật ngữ:
  - `CV Import` / `Nhập CV`.
  - `Candidate Profile` / `Hồ sơ ứng viên`.
  - `Import history` / `Lịch sử nhập CV`.
  - Giữ nguyên tên riêng và thuật ngữ sản phẩm như SmartHire, OpenAI, PDF, DOCX, CV.
- Không dịch mã lỗi, ID hoặc phiên bản consent khi chúng cần cho chẩn đoán, nhưng phần giải thích cho người dùng phải được bản địa hóa.
- Không hiển thị trực tiếp thông báo backend không kiểm soát. Map lỗi theo code/trạng thái/action sang copy an toàn.
- Dùng `Intl.DateTimeFormat` với `vi-VN` hoặc `en-US` tùy locale.
- Rà soát encoding UTF-8, dấu câu, viết hoa, số ít/số nhiều và độ dài câu tiếng Việt trên màn hình 320 px.

## 4. Kế hoạch triển khai chi tiết

### Giai đoạn 0 — Lập baseline trước khi sửa

1. Chạy test hiện tại cho Jobs, Preferences và CV Import để phân biệt lỗi có sẵn với regression.
2. Ghi lại ảnh/chỉ số thủ công cho các viewport tối thiểu: 1440×900, 1024×768, 760×900 và 320×568; kiểm tra cả light/dark.
3. Kiểm tra bốn trạng thái phiên:
   - `/jobs` chưa đăng nhập.
   - `/jobs` đã đăng nhập.
   - `/profile/preferences` với ngôn ngữ đang lưu là English.
   - `/profile/cv-imports` với dữ liệu ở các trạng thái upload, processing, failure, review và confirmed.

### Giai đoạn 1 — Khôi phục Preferences và nền tảng locale

#### 1.1. Đưa locale đã lưu vào workspace shell

- Sửa `web/src/backend/auth/get-workspace-context.ts`:
  - Select thêm `preferences.language` từ quan hệ hiện có.
  - Chuyển enum database thành `"vi" | "en"` ở projection an toàn.
  - Fallback theo default nghiệp vụ hiện có khi account chưa có hàng preferences.
- Sửa hai nơi dựng shell:
  - `web/src/app/(workspace)/layout.tsx` truyền `initialLocale`.
  - `web/src/app/jobs/layout.tsx` truyền `initialLocale` cho nhánh đã đăng nhập.
- Không thay đổi schema, migration hoặc public API.

#### 1.2. Biến `WorkspaceLocaleProvider` thành state hoạt động

- Sửa `web/src/frontend/features/dashboard/client/workspace-locale.tsx`:
  - Nhận và chuẩn hóa `initialLocale`.
  - Cung cấp locale đọc và action cập nhật locale.
  - Đồng bộ `document.documentElement.lang` khi locale đổi.
  - Bảo đảm render đầu tiên khớp locale server để tránh hydration mismatch/nhấp nháy ngôn ngữ.
- Sửa `web/src/frontend/features/dashboard/components/workspace-shell.tsx`:
  - Nhận `initialLocale`.
  - Dùng `useWorkspaceLocale()` cho copy topbar, sidebar, profile action và lỗi sign-out.
  - Thay `lang="en"` cố định bằng locale hiện tại.
- Sửa `web/src/frontend/features/dashboard/components/workspace-navigation.tsx` để dịch navigation, menu mobile và sign-out theo locale.

#### 1.3. Kích hoạt lại form Language

- Sửa `web/src/frontend/features/profile/client/use-account-preferences.ts`:
  - Xóa `normalizeEnglishPreferences`.
  - Khởi tạo và cập nhật state bằng giá trị thật.
  - Gửi `preferences.language` trong PUT.
  - Dịch feedback theo locale được chọn/lưu.
  - Sau response hợp lệ, cập nhật saved state, cập nhật `WorkspaceLocaleProvider`, rồi refresh router.
  - Nếu save thất bại, giữ locale toàn cục cũ và giữ dữ liệu form để người dùng thử lại.
- Sửa `web/src/frontend/features/profile/components/account-preferences-form.tsx`:
  - Bỏ `disabled` và `value="en"` cố định.
  - Bind select với `preferences.language`.
  - Thêm `English` và `Tiếng Việt`.
  - Dịch label, hint, timezone copy, trạng thái saving và nút Save.
- Sửa:
  - `web/src/frontend/features/profile/components/profile-preferences-view.tsx`.
  - `web/src/frontend/features/profile/components/notification-preferences.tsx`.
  - `web/src/frontend/features/profile/styles/account-preferences.css` nếu câu tiếng Việt làm vỡ layout.
- Dùng copy helper của khu vực Profile hoặc một dictionary nhỏ có type; không nhân đôi object dịch trong nhiều component.

#### 1.4. Test Preferences/locale

- Cập nhật `web/tests/frontend/accessibility/account-preferences.accessibility.test.tsx`:
  - Select ngôn ngữ hoạt động, có đủ hai lựa chọn và không có lỗi axe.
- Cập nhật `web/tests/frontend/components/auth/navigation-shells.test.tsx`:
  - Bỏ giả định workspace luôn là tiếng Anh.
  - Kiểm tra shell/navigation render đúng cả `en` và `vi`.
- Bổ sung test cho hook/provider:
  - Hydrate bằng locale đã lưu.
  - Chọn `vi` làm form dirty.
  - PUT gửi đúng `language: "vi"`.
  - Save thành công cập nhật shell và thuộc tính `lang`.
  - Save thất bại không đổi locale toàn cục.
- Cập nhật `web/tests/system/e2e/profile-account/account-preferences.spec.ts`:
  - Đổi English → Tiếng Việt, lưu, điều hướng sang trang khác và reload/đăng nhập lại vẫn là tiếng Việt.
  - Đổi ngược về English để kiểm tra hai chiều.

### Giai đoạn 2 — Chuẩn hóa ngôn ngữ CV Import

#### 2.1. Tạo lớp copy/formatter dùng chung

- Thêm một module có type, ví dụ:
  - `web/src/frontend/features/cv-import/i18n/cv-import-copy.ts` cho copy `vi/en`.
  - `web/src/frontend/features/cv-import/i18n/cv-import-formatters.ts` cho status, stage, ngày/giờ, field label và lỗi.
- Dictionary phải bao phủ toàn bộ state thực tế từ contracts, có kiểm tra compile-time để khi enum thêm giá trị mới sẽ không âm thầm hiện mã kỹ thuật.
- Tách copy khỏi contracts/domain: contract vẫn giữ dữ liệu và mã máy; lớp presentation quyết định câu chữ.

#### 2.2. Localize route-level content

- Sửa các route:
  - `web/src/app/(workspace)/profile/cv-imports/page.tsx`.
  - `web/src/app/(workspace)/profile/cv-imports/[uploadId]/page.tsx`.
  - `web/src/app/(workspace)/profile/cv-imports/[uploadId]/review/page.tsx`.
- Các Server Component lấy locale từ workspace context và chọn copy bằng helper thuần.
- Chuẩn hóa page title, subtitle, breadcrumb/back link, empty/error state và metadata.

#### 2.3. Localize component và hook

- Sửa các client hook để nhận/dùng locale thay vì dựng câu tiếng Anh trực tiếp:
  - `client/use-cv-import.ts`.
  - `client/use-cv-draft-review.ts`.
- Sửa toàn bộ component có nội dung cho người dùng:
  - `cv-import-workspace.tsx`, `cv-import-page.tsx`, `cv-upload-form.tsx`, `cv-import-list.tsx`.
  - `cv-import-status.tsx`, `cv-processing-notice.tsx`, `cv-processing-consent.tsx`.
  - `cv-failure-recovery.tsx`, `cv-retention-actions.tsx`.
  - `cv-draft-review.tsx`, `cv-scalar-review.tsx`, `cv-collection-review.tsx`.
  - `cv-evidence.tsx`, `cv-review-feedback.tsx`, `cv-review-conflict.tsx`.
  - `cv-confirmation-receipt.tsx`.
- Thay toàn bộ:
  - Raw status lowercasing bằng status formatter.
  - `en-US` cố định bằng formatter theo locale.
  - Alert, `aria-label`, `aria-live`, button busy text, confirm dialog và error/retry copy bằng dictionary.
  - Field label trong review bằng mapping song ngữ thống nhất.
- Kiểm tra các module CSS tương ứng, chỉ chỉnh khi câu tiếng Việt gây tràn, nút quá hẹp hoặc grid không co được. Không thay đổi visual identity hiện có.

#### 2.4. Biên tập nội dung CV

- Rà soát từng màn hình theo checklist:
  - Không trộn Việt/Anh trong cùng một trạng thái giao diện, ngoại trừ tên riêng/định dạng được chủ ý giữ nguyên.
  - Cùng một hành động dùng cùng một thuật ngữ ở upload, status, history và review.
  - Trạng thái progress dùng cùng hệ động từ và cùng kiểu viết hoa.
  - Lỗi giải thích được nguyên nhân, dữ liệu có an toàn không và hành động tiếp theo.
  - Consent phân biệt rõ “cho phép xử lý trong tương lai” với dữ liệu đã gửi trước đó.
  - Dấu câu, Unicode và encoding hiển thị đúng.

#### 2.5. Test CV Import

- Cập nhật các test component trong `web/tests/frontend/components/cv-import/` để chạy các flow đại diện bằng cả `en` và `vi`.
- Cập nhật các test accessibility trong `web/tests/frontend/accessibility/cv-import/` để kiểm tra accessible name sau khi dịch và không có lỗi axe.
- Cập nhật E2E trong `web/tests/system/e2e/cv-import/` cho các luồng:
  - Upload → processing → draft.
  - Failure → retry/delete/manual profile.
  - Consent grant/revoke.
  - Review conflict và confirmation.
  - Persist ngôn ngữ khi reload hoặc qua thiết bị/session mới.
- Giữ nguyên các test security, privacy, retention và data-boundary; bản địa hóa không được thay đổi payload, consent version, redaction hoặc chính sách lưu/xóa CV.

### Giai đoạn 3 — Bổ sung theme toggle cho Jobs công khai

1. Sửa `web/src/frontend/features/jobs/components/job-board-header.tsx`:
   - Import và render `ThemeToggle` trong nhóm action của header.
   - Dùng compact ở breakpoint phù hợp.
   - Giữ cấu trúc navigation hợp lệ; button theme không giả làm navigation link.
2. Sửa `web/src/frontend/features/jobs/styles/job-board.css`:
   - Thêm layout cho `.job-board-header-actions`.
   - Bảo đảm logo, toggle, Sign in và Create account không tràn ở 320 px.
   - Giữ vùng chạm tối thiểu, focus-visible, contrast ở cả hai theme.
3. Cập nhật `web/tests/frontend/components/jobs/job-navigation.test.tsx`:
   - Public header có theme toggle.
   - Click đổi `aria-pressed`, `data-theme` và lưu preference.
   - Header authenticated không bị nhân đôi toggle vì đã dùng `WorkspaceShell`.
4. Bổ sung/điều chỉnh accessibility test cho tên nút và keyboard operation.

### Giai đoạn 4 — Tách ba vùng và cuộn độc lập cho Jobs

#### 4.1. Tạo cấu trúc vùng rõ ràng

- Sửa `web/src/app/jobs/page.tsx`:
  - Bọc page heading và `job-board-tabs` trong một vùng cố định, ví dụ `.jobs-fixed-region`.
  - Giữ `.jobs-grid` là vùng nội dung còn lại.
  - Đặt nhãn landmark rõ ràng cho filter và results.
  - Nếu thêm `tabIndex` để pane nhận focus, chỉ dùng khi cần cho keyboard scrolling và phải có focus-visible rõ ràng.
- Không thay đổi query/filter/search behavior, URL parameters hoặc server data loading.

#### 4.2. Public Jobs shell

- Sửa `web/src/app/jobs/layout.tsx` và `job-board.css`:
  - Public `.job-board-layout` dùng `height: 100dvh`, grid rows `auto minmax(0, 1fr)` và chặn document scroll trên desktop Jobs.
  - `.job-board-public-main`, `.jobs-page` và `.jobs-grid` truyền đúng chuỗi chiều cao bằng `min-height: 0`.
  - Header công khai và vùng `jobs-fixed-region` luôn ở trên hai pane cuộn.

#### 4.3. Authenticated Jobs shell

- Thêm một prop/data attribute scoped, ví dụ `contentMode="job-board"`, cho `WorkspaceShell`.
- `web/src/app/jobs/layout.tsx` chỉ truyền mode này ở route Jobs đã đăng nhập.
- Sửa `web/src/frontend/styles/workspace.css` bằng selector scoped:
  - Ở mode Jobs desktop, `.workspace-main` không cuộn toàn trang.
  - `.workspace-content` và `.jobs-page` nhận phần chiều cao còn lại.
  - Dashboard/Profile và các route workspace khác giữ hành vi scroll hiện tại.

#### 4.4. Hai pane cuộn

- Sửa `web/src/frontend/features/jobs/styles/job-board.css`:
  - `.jobs-grid`: `min-height: 0`, `height: 100%`, `align-items: stretch`.
  - `.job-filter-column` và `.job-results`: `min-height: 0`, `overflow-y: auto`, `overscroll-behavior-y: contain`, `scrollbar-gutter: stable`.
  - Bỏ `position: sticky/top` cũ của filter trong desktop contained layout vì pane đã có vùng riêng.
  - Giữ khoảng đệm bên trong để scrollbar không che nội dung.
  - Kiểm tra dark theme cho scrollbar/native controls mà không tạo style phụ thuộc trình duyệt không cần thiết.
- Ở `@media (max-width: 980px)`:
  - Trả layout về `height: auto`, `overflow: visible`, một cột và một scroll container.
  - Không để `100dvh` gây che nội dung bởi mobile browser chrome.

#### 4.5. Test layout và tương tác cuộn

- Cập nhật `web/tests/frontend/components/jobs/job-discovery.test.tsx` để kiểm tra cấu trúc ba vùng và class/data mode đúng.
- Cập nhật `web/tests/frontend/accessibility/jobs/job-discovery.accessibility.test.tsx` cho landmark/name/focus.
- Cập nhật `web/tests/system/e2e/job-board/job-discovery.spec.ts`:
  - Đồng bộ heading/selector với UI thực tế, loại bỏ expectation cũ nếu không còn đúng.
  - Trên desktop, cuộn filter không làm đổi `scrollTop` của results và ngược lại.
  - Header, heading và tabs giữ nguyên vị trí khi cuộn mỗi pane.
  - Wheel hoạt động theo vị trí con trỏ; keyboard vẫn cuộn được vùng có focus.
  - Public và authenticated Jobs đều hoạt động.
  - Ở mobile, chỉ có luồng cuộn trang tự nhiên và không có vùng bị kẹt.

### Giai đoạn 5 — Kiểm thử hồi quy và nghiệm thu

Chạy theo thứ tự để phản hồi nhanh:

```powershell
npm run typecheck --workspace @smarthire/web
npm run lint --workspace @smarthire/web
npm run test:profile-account --workspace @smarthire/web
npm run test:job-board --workspace @smarthire/web
npm run test:cv-import --workspace @smarthire/web
npm run test --workspace @smarthire/web
npm run test:e2e --workspace @smarthire/web -- --project chromium
```

Nếu cấu hình Playwright không có project tên `chromium`, chạy `npm run test:e2e --workspace @smarthire/web` theo cấu hình hiện tại.

QA thủ công cuối:

- Light/dark: public Jobs, authenticated Jobs, Preferences, toàn bộ CV Import.
- Locale: English và Tiếng Việt; reload, chuyển route, sign out/sign in lại.
- Viewport: 1440, 1024, 980, 760, 520 và 320 px.
- Input: mouse wheel, trackpad, keyboard, touch.
- Accessibility: focus order, focus visible, screen-reader names, live regions, contrast, zoom 200% và reduced motion.
- Browser: Chromium trước; kiểm tra thêm Firefox/WebKit cho nested overflow và `100dvh`.

## 5. Ma trận file dự kiến thay đổi

| Nhóm          | File chính                                                                                                                                                 | Mục đích                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Locale source | `web/src/backend/auth/get-workspace-context.ts`                                                                                                            | Đưa locale đã lưu vào safe workspace projection |
| Workspace     | `web/src/app/(workspace)/layout.tsx`, `web/src/frontend/features/dashboard/client/workspace-locale.tsx`, `workspace-shell.tsx`, `workspace-navigation.tsx` | Khởi tạo, cập nhật và hiển thị locale thực      |
| Preferences   | `use-account-preferences.ts`, `account-preferences-form.tsx`, `profile-preferences-view.tsx`, `notification-preferences.tsx`                               | Bật select vi/en và lưu đúng giá trị            |
| CV route      | Ba page trong `web/src/app/(workspace)/profile/cv-imports/`                                                                                                | Copy server-side theo locale                    |
| CV i18n       | Module mới dưới `web/src/frontend/features/cv-import/i18n/`                                                                                                | Dictionary và formatter có type                 |
| CV UI         | Hai hook và toàn bộ component `.tsx` dưới feature CV Import                                                                                                | Loại bỏ copy rải rác/raw enum, chuẩn hóa vi/en  |
| Public theme  | `job-board-header.tsx`, `job-board.css`                                                                                                                    | Thêm toggle và responsive                       |
| Jobs layout   | `web/src/app/jobs/layout.tsx`, `page.tsx`, `job-board.css`, `workspace-shell.tsx`, `workspace.css`                                                         | Vùng fixed và hai pane scroll độc lập           |
| Tests         | Các suite Preferences, dashboard shell, Jobs và CV Import được nêu ở trên                                                                                  | Khóa hành vi mới và chống regression            |

Các file CSS module CV chỉ sửa nếu QA cho thấy text tiếng Việt tràn hoặc làm hỏng responsive; không sửa đồng loạt khi không cần.

## 6. Tiêu chí nghiệm thu theo yêu cầu

### Yêu cầu 1 — Theme khi chưa login

- `/jobs` khi chưa đăng nhập luôn có nút chuyển light/dark dễ thấy và dùng được bằng keyboard.
- Nút cập nhật theme ngay, lưu lựa chọn và không bị mất khi reload/chuyển route.
- Không có hai nút theme trong Jobs đã đăng nhập.
- Header không tràn hoặc che link ở 320 px.

### Yêu cầu 2 — Bố cục Jobs

- Trên desktop, shell header cùng phần `Jobs` và tabs phía trên không di chuyển khi cuộn bộ lọc hoặc kết quả.
- Wheel/trackpad trên Refine Search chỉ cuộn filter; trên Job results chỉ cuộn danh sách kết quả.
- Hai pane không truyền scroll ngoài ý muốn khi chạm biên.
- Keyboard và focus vẫn sử dụng được; không phụ thuộc duy nhất vào hover.
- Trên mobile/tablet, layout trở về một cột và cuộn trang tự nhiên, không có nested-scroll trap.
- Các trang Dashboard/Profile khác không thay đổi hành vi scroll.

### Yêu cầu 3 — CV Import đồng nhất ngôn ngữ

- Khi locale là `vi`, toàn bộ nội dung CV Import thuộc presentation layer hiển thị tiếng Việt; khi là `en`, hiển thị tiếng Anh.
- Không còn raw enum như `review_ready`, status lowercased hoặc ngày luôn theo `en-US`.
- Thuật ngữ, capitalization, dấu câu và action label nhất quán xuyên suốt upload/history/status/review/confirmation.
- Proper nouns và dữ liệu kỹ thuật cần thiết được giữ đúng; không làm thay đổi consent/security/privacy behavior.
- Không có text overflow ở 320 px và accessible names khớp ngôn ngữ đang dùng.

### Yêu cầu 4 — Language Preferences hoạt động

- Select Language enabled, có `English` và `Tiếng Việt`.
- Chọn ngôn ngữ làm form dirty; Save gửi đúng giá trị lên API.
- Save thành công đổi workspace ngay và duy trì sau reload/session mới.
- Save thất bại hiển thị lỗi đúng ngôn ngữ nhưng không đổi locale toàn cục.
- `html[lang]` và workspace `lang` phản ánh đúng ngôn ngữ hiện tại.

## 7. Rủi ro và cách kiểm soát

- **Nested scroll gây khó dùng:** chỉ bật ở desktop; dùng native overflow và `overscroll-behavior`, không viết wheel handler.
- **Thay đổi `WorkspaceShell` ảnh hưởng toàn hệ thống:** mọi CSS/prop layout Jobs phải scoped bằng `contentMode`; có regression test Dashboard/Profile.
- **Hydration mismatch locale:** locale ban đầu phải đến từ server context và dùng nhất quán ở lần render đầu.
- **Người dùng chọn locale nhưng chưa lưu:** provider chỉ cập nhật sau response save thành công.
- **Copy CV thiếu trạng thái:** mapping phải exhaustive theo union/enum trong contract và fail ở compile-time khi trạng thái mới chưa có bản dịch.
- **Thông báo backend làm trộn ngôn ngữ hoặc lộ chi tiết:** localize theo error code/action đã biết, fallback bằng câu an toàn.
- **Câu tiếng Việt dài:** kiểm tra wrap, `min-width: 0`, button layout và 320 px; chỉ chỉnh CSS cần thiết.
- **Breakpoint 980 px bị giật layout:** test tại 979/980/981 px và bảo đảm chỉ có một scroll owner ở mỗi chế độ.
- **Theme toggle chật trên mobile:** dùng compact, giữ vùng chạm và accessible label.

## 8. Thứ tự triển khai khuyến nghị

1. Locale provider và Preferences.
2. CV Import i18n/editorial pass dựa trên locale đã hoạt động.
3. Theme toggle công khai.
4. Jobs contained layout và independent scroll.
5. Test đầy đủ, QA responsive/accessibility và sửa regression.

Thứ tự này tránh việc CV Import phải dùng một cơ chế locale tạm thời, đồng thời tách thay đổi logic ngôn ngữ khỏi thay đổi layout Jobs để dễ review và rollback.

## 9. Điều kiện hoàn tất

Chỉ xem implementation hoàn tất khi:

- Tất cả tiêu chí nghiệm thu ở mục 6 đạt.
- Typecheck, lint và các suite liên quan đều pass.
- Không có migration/schema/API contract mới không cần thiết.
- Không có thay đổi ngoài phạm vi UI và plumbing locale tối thiểu đã nêu.
- Không có file nào trong SpecKit bị đọc để quyết định implementation hoặc bị thay đổi.
- Diff cuối cùng được rà soát để chắc chắn không mang theo file sinh tự động, ảnh test hoặc thay đổi không liên quan.
