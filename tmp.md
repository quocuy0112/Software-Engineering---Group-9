• Đã fix xong Image Search và xác minh toàn bộ stack đang hoạt động.

  Các dịch vụ hiện tại:

  - PostgreSQL: healthy
  - ClamAV: healthy
  - OCR engine: healthy
  - CV worker: Up
  - Image-search worker: Up
  - Readiness CLEANUP và RECONCILIATION: hợp lệ

  Các lỗi đã sửa:

  - Bổ sung đường dẫn container CV_STORAGE_LOCAL_ROOT cho image worker trong /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-Engineering---Group-9/
    compose.yaml:143.

  - Xử lý lỗi chmod EPERM trên Docker Desktop Windows bằng cờ local-only trong /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-Engineering---Group-
    9/web/src/backend/image-search/storage/filesystem.ts:34.

  - Sửa Uvicorn tạo OCR socket ở mode 0666; hiện socket được tạo an toàn với mode 0660 tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-
    Engineering---Group-9/ocr-engine/src/app.py:189.

  - Không mount dữ liệu CV vào image worker; hai loại dữ liệu vẫn được cô lập.

  Kết quả kiểm tra:

  - Image worker probe: passed cho PostgreSQL, private storage, ClamAV và OCR.
  - OCR socket: 660:10001:102.
  - Python OCR: 9/9 tests passed.
  - Image-search/security: 10/10 tests passed.
  - TypeScript typecheck: passed.
  - ONNX Removing initializer... vẫn xuất hiện nhưng chỉ là cảnh báo tối ưu model, không phải lỗi.

  ## Cách khởi động ổn định trên Windows

  Từ thư mục gốc dự án:

  docker compose up -d --build postgres clamav ocr-engine cv-worker image-search-worker
  docker compose ps
  docker compose exec -T image-search-worker node scripts/run-image-search-worker.mjs --probe
  npm.cmd run dev:web

  Truy cập:

  http://localhost:3001

  Cách này tránh startup race của email worker. Nếu muốn chạy toàn bộ supervisor, hãy đợi PostgreSQL healthy rồi chạy:

  npm.cmd run dev

  Không dùng docker compose down -v trừ khi muốn xóa cả database và volumes.

  ## Luồng Image Search nội bộ

  1. Mở /jobs.
  2. Mở phần tìm kiếm bằng ảnh.
  3. Chọn ảnh poster tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-Engineering---Group-9/web/src/frontend/features/jobs/image-search/
     components/image-search-input.tsx:41.

  Ảnh hợp lệ:

  - PNG hoặc JPEG.
  - Không quá 5 MB.
  - Không quá 20 megapixel.
  - Không dùng ảnh động, file hỏng hoặc file có extension sai loại.

  4. Giữ Optional external interpretation ở trạng thái bỏ chọn.

  Đây là chế độ hiện đang được cấu hình:

  IMAGE_SEARCH_INTERPRETER=deterministic
  IMAGE_SEARCH_OPENAI_ENABLED=false

  Luồng xử lý:

  Upload
  → ClamAV safety scan
  → Decode và chuẩn hóa ảnh
  → OCR nội bộ
  → Deterministic interpretation
  → Review suggested filters
  → Apply filters
  → Hiển thị việc làm

  5. Khi hệ thống đưa ra filter:

  - Filter rõ ràng, độ tin cậy cao có thể được chọn sẵn.
  - Filter suy đoán hoặc độ tin cậy thấp sẽ yêu cầu review.
  - Có thể sửa giá trị, bỏ chọn, remove, reverse selections hoặc clear.
  - Nhấn Apply selected filters tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-Engineering---Group-9/web/src/frontend/features/jobs/image-
    search/components/image-search-proposals.tsx:151.

  Ảnh và OCR text không được đưa vào URL tìm việc. URL chỉ chứa các filter đã được người dùng nhìn thấy và chấp nhận.

  ## Manual fallback của Image Search

  Nếu OCR đọc được chữ nhưng không thể tạo filter an toàn, UI sẽ hiện Use recognized text manually tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/
  Software-Engineering---Group-9/web/src/frontend/features/jobs/image-search/components/image-search-recovery.tsx:22.

  Có hai lựa chọn:

  - Use as keyword search: dùng OCR text làm từ khóa thường.
  - Try another image: bỏ kết quả hiện tại và chọn ảnh khác.

  Nếu scan, decode hoặc OCR thất bại:

  - Search manually: quay về tìm kiếm text/filter thông thường.
  - Try another image: thử file mới.

  Manual search luôn hoạt động độc lập với OCR và OpenAI.

  Giới hạn hiện tại:

  - Visitor chưa đăng nhập: 3 image search/giờ.
  - Tài khoản đăng nhập: 10 image search/giờ.
  - Dữ liệu ảnh được đặt thời hạn xóa 15 phút.

  ## Luồng Image Search bằng OpenAI

  Chỉ dùng khi thật sự có cấu hình và phê duyệt xử lý dữ liệu bên ngoài. Checkbox nằm tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-
  Engineering---Group-9/web/src/frontend/features/jobs/image-search/components/image-search-consent.tsx:12.

  Các cấu hình image search độc lập với OpenAI của CV import. Tối thiểu cần:

  IMAGE_SEARCH_INTERPRETER=openai
  IMAGE_SEARCH_OPENAI_ENABLED=true
  OPENAI_API_KEY=<server-only secret>

  Production còn yêu cầu các approval:

  IMAGE_SEARCH_OPENAI_DPA_APPROVED=true
  IMAGE_SEARCH_OPENAI_PRIVACY_APPROVED=true
  IMAGE_SEARCH_OPENAI_CROSS_BORDER_APPROVED=true
  IMAGE_SEARCH_OPENAI_ZDR_APPROVED=true

  Giữ .env và web/.env.local đồng bộ, sau đó restart web và worker:

  docker compose up -d --build --force-recreate image-search-worker
  npm.cmd run dev:web

  Ở chế độ này, ảnh vẫn được scan và OCR nội bộ trước. Chỉ recognized text được gửi tới provider sau khi người dùng bật lựa chọn external. Nếu cấu
  hình vẫn là deterministic mà bật checkbox, backend sẽ từ chối với “External interpretation is unavailable”.

  ## Luồng CV Import deterministic

  1. Đăng nhập tài khoản Candidate.
  2. Mở /profile/cv-imports.
  3. Chọn PDF hoặc DOCX, tối đa 5 MB.
  4. Chọn SmartHire deterministic tại /D:/1.HocTapKy3/IntroductionSE/GithubRes/Software-Engineering---Group-9/web/src/frontend/features/cv-import/
     components/cv-upload-form.tsx:147.

  5. Nhấn Upload CV.

  Luồng xử lý:

  Upload
  → Validate
  → ClamAV scan
  → Native text extraction
  → OCR nếu PDF/DOCX có trang hoặc ảnh cần OCR
  → Deterministic parsing
  → Draft review
  → Save review
  → Confirm
  → Update Profile

  Điểm quan trọng:

  - Deterministic không có nghĩa là không dùng OCR.
  - OCR vẫn chạy cục bộ cho PDF scan, image-only PDF hoặc ảnh nằm trong DOCX.
  - Không gửi CV text cho OpenAI.
  - Profile chưa bị thay đổi trong lúc upload hoặc parse.
  - Profile chỉ được cập nhật sau khi review, lưu quyết định và confirm.

  Trong màn hình review:

  - Kiểm tra từng proposal.
  - Chọn add, replace hoặc skip tùy trường.
  - Sửa giá trị OCR/parser nhận sai.
  - Tick I have reviewed every proposal.
  - Nhấn Save review.
  - Sau khi save thành công mới nhấn Confirm.

  ## Luồng CV Import bằng OpenAI

  1. Chọn External OpenAI.
  2. Upload vẫn đi qua validate, ClamAV, extraction và OCR nội bộ.
  3. Hệ thống dừng tại bước consent.
  4. Đọc notice và grant consent.
  5. Chỉ sau khi consent hợp lệ, extracted text mới được gửi để parse.
  6. Review và confirm giống deterministic.

  Nếu revoke consent trước khi dispatch, hệ thống không được gửi request ra ngoài.

  OpenAI của CV sử dụng nhóm biến CV_PARSER_ADAPTER, CV_OPENAI_ENABLED riêng. Bật OpenAI cho CV không tự động bật Image Search OpenAI.

  ## Khi CV upload trả 429

  Đây là quota, không phải worker hỏng:

  - Tối đa 5 lần upload trong một rolling hour.
  - Tối đa 10 import đang được giữ.
  - Tổng storage tối đa khoảng 50 MiB.

  Khi gặp 429:

  - Không cần restart Docker.
  - Đợi lượt upload cũ ra khỏi cửa sổ một giờ.
  - Không bấm upload liên tục vì mỗi upload được reserve có thể tiếp tục tính vào quota.
  - Có thể dùng /profile để nhập hồ sơ thủ công trong lúc chờ.

  ## Lệnh chẩn đoán nhanh

  docker compose ps
  docker compose logs --tail 100 image-search-worker
  docker compose logs --tail 100 ocr-engine
  docker compose exec -T image-search-worker node scripts/run-image-search-worker.mjs --probe

  Kết quả probe mong đợi:

  Image-search worker probe passed for PostgreSQL, private storage, scanner, and OCR boundaries.