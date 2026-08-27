# Kế hoạch nâng cấp OCR cho tìm kiếm Jobs bằng hình ảnh

**Trạng thái:** Đã implement Phase 1 MVP ở mức code; chưa đủ bằng chứng để bật release gate/canary  
**Ngày lập:** 2026-08-27  
**Phạm vi:** `JOB_IMAGE_SEARCH`  
**Nguồn rà soát:** CodeGraph trên repository hiện tại, source code, test corpus và performance harness đang có

> **Ghi chú triển khai 2026-08-27:** Candidate strategy đã được đặt sau feature flag
> `OCR_SEARCH_ADAPTIVE_TILING_ENABLED` (mặc định `false` để rollback an toàn). Các
> kiểm thử có thể chạy được đã pass, nhưng chưa được coi là bằng chứng release:
> môi trường hiện tại không có Python/Docker để chạy OCR engine thật, nên chưa có
> corpus accuracy, RSS/CPU peak hoặc end-to-end lease evidence.

## 1. Quyết định kiến trúc

Nâng cấp theo hướng **adaptive full-image detection + overlapping tiled recovery + coordinate-aware merge**.

Tiling phải được thực hiện bên trong OCR engine cho riêng `JOB_IMAGE_SEARCH`, trong cùng một recognition request. Không tạo bốn artifact, không gọi bốn HTTP/UDS request độc lập từ image-search worker và không thay đổi public API của image search.

Luồng mục tiêu:

```text
Ảnh đã scan sạch và normalize
        |
        v
Full-image detection nhanh
        |
        +-- tín hiệu đủ tốt --------------------------+
        |                                             |
        +-- không có chữ / chữ nhỏ / quá dày --------+--> nhận dạng theo batch
                         |                             |
                         v                             |
                Chia tile có overlap                  |
                         |                             |
                Detect tile theo batch                |
                         |                             |
                Đổi polygon về ảnh gốc ---------------+
                                                       |
                                                       v
                                           Deduplicate + reading order
                                                       |
                                                       v
                                             `ocr-lines-v1` hiện tại
                                                       |
                                                       v
                                       Interpret intent -> tìm Jobs
```

Lý do chọn vị trí này:

- Một ảnh chỉ được malware scan, decode, mã hóa và đọc artifact một lần.
- Engine đã có ảnh RGB trong memory và đã trả polygon, nên đây là nơi ít chuyển đổi và ít I/O nhất để crop/merge.
- Code hiện tại gọi detector bằng một danh sách chứa đúng một ảnh (`[image_array]`). Khả năng batch nhiều ảnh khác kích thước chưa được chứng minh, nên phải có adapter probe và shape guard trước khi bật batch 2/4.
- `ocr-lines-v1`, state machine, database và frontend có thể giữ nguyên ở giai đoạn đầu.
- Nhánh `CV_IMPORT` tiếp tục dùng pipeline hiện tại, giảm blast radius.

## 2. Mục tiêu và tiêu chí thành công

### 2.1 Mục tiêu sản phẩm

- Giảm trường hợp ảnh rõ nhưng hệ thống báo không đọc được hoặc không đề xuất được tiêu chí tìm kiếm.
- Đọc tốt hơn poster có chữ nhỏ, nhiều cột, nhiều vùng chữ và ảnh chụp màn hình điện thoại.
- Không làm mọi ảnh chậm hơn: ảnh dễ vẫn đi fast path; chỉ ảnh khó mới dùng recovery path.
- Phân biệt rõ lỗi OCR, lỗi diễn giải intent và trường hợp không có Job phù hợp.

### 2.2 Release gates

Các gate dưới đây phải được đo trên kết quả inference thật, không dùng self-test tổng hợp:

| Nhóm               | Gate bắt buộc                                                       |
| ------------------ | ------------------------------------------------------------------- |
| OCR tổng thể       | Word accuracy tối thiểu 95% như gate hiện tại                       |
| Theo ngôn ngữ      | Việt, Anh và song ngữ đều tối thiểu 90%                             |
| Job poster rõ      | Tỷ lệ `zero text` giảm ít nhất 50% so với baseline                  |
| Job title          | Recall tăng ít nhất 15 điểm phần trăm so với baseline               |
| Intent được hỗ trợ | Chính xác tối thiểu 90%, không thấp hơn baseline                    |
| Bảo mật            | Security disposition recall giữ nguyên 100%                         |
| Hiệu năng          | 95% truy vấn warm tạo kết quả actionable trong tối đa 10 giây       |
| Deadline           | Không OCR request nào vượt hard deadline 10 giây                    |
| Job search         | 95% deterministic search hoàn thành trong tối đa 2 giây             |
| CV regression      | Không giảm accuracy, deadline hoặc failure-recovery của `CV_IMPORT` |

Ngoài gate tuyệt đối, báo cáo phải có p50, p95, p99, error rate, CPU peak và memory peak cho baseline lẫn candidate.

## 3. Hiện trạng đã xác nhận bằng CodeGraph

### 3.1 Luồng hiện tại

CodeGraph xác nhận call path chính:

1. `GlobalImageSearch` gọi `useImageSearch`.
2. Client reserve query, upload PNG/JPEG, poll trạng thái rồi consume result.
3. `ImageSearchWorkerRuntime` claim tuần tự các stage `SCAN`, `DECODE`, `OCR`, `INTERPRET` với tổng concurrency mặc định là 4.
4. `ImageSearchDecodeStage` dùng `SharpImageNormalizer` tạo một artifact `NORMALIZED_IMAGE`.
5. `ImageSearchOcrStage` đọc và giải mã artifact, gọi `UnixOcrEngine` qua private Unix socket.
6. Python engine chạy nhánh `_recognize_search`, trả text, confidence và polygon.
7. OCR text được lưu thành artifact `OCR_TEXT`, sau đó `ImageSearchInterpretStage` gửi text sang interpreter.
8. `SearchIntentSelectionPolicy` kiểm tra field, confidence và evidence trước khi trả intent cho người dùng.

### 3.2 Các giới hạn hiện tại ảnh hưởng trực tiếp đến chất lượng

| Thành phần          | Hiện trạng                                                                            |
| ------------------- | ------------------------------------------------------------------------------------- |
| Upload              | PNG/JPEG, tối đa 5 MB                                                                 |
| Decode              | Tối đa 20 triệu decoded pixels                                                        |
| Normalize           | Giữ tỷ lệ, không phóng ảnh nhỏ, cạnh tối đa 2048px                                    |
| Detector search     | Cạnh detection giới hạn 640px                                                         |
| Recognition         | Batch size 5                                                                          |
| Số vùng             | Baseline tối đa 40 vùng; Phase 1 dùng budget động với hard safety cap 100             |
| Dòng dài            | Aspect ratio tối đa 64; dòng đầu quá dài có thể bị cắt, các dòng dài sau có thể bị bỏ |
| OCR deadline        | 10 giây                                                                               |
| Confidence fallback | Average confidence dưới 0.6                                                           |
| Engine CPU          | ONNX intra-op 4, inter-op 1                                                           |
| Container OCR       | Giới hạn 4 CPU, 8 GB RAM                                                              |
| Worker              | Concurrency mặc định 4                                                                |
| Orientation/unwarp  | Đang tắt document orientation, text-line orientation và unwarping                     |

Điểm nghẽn nổi bật là ảnh có thể còn 2048px nhưng detector chỉ nhìn phiên bản có cạnh giới hạn 640px. Chữ nhỏ trên poster vì vậy có thể mất trước recognition.

### 3.3 Khoảng trống baseline về hành vi và đo lường

Các điểm dưới đây là khoảng trống được ghi nhận trước khi implement Phase 1;
trạng thái sau implement được chốt lại ở mục 14.1.

- `OCR_LOW_CONFIDENCE` khi không có text hiện rơi vào mapping mặc định `OCR_UNAVAILABLE`; người dùng không biết là “không phát hiện chữ” hay engine đang lỗi.
- Evidence hiện được resolve bằng substring chính xác; khác dấu, dấu câu hoặc một lỗi OCR nhỏ có thể làm proposal bị loại.
- Fallback không cho người dùng chỉnh các keyword OCR đã đọc được, nên OCR một phần dễ bị cảm nhận là thất bại hoàn toàn.
- Telemetry hiện chỉ có bucket tổng quát; chưa đo strategy, số box detector, số tile, tile recovery hit, duplicate count và thời gian detect/recognize/merge.
- Performance harness hiện kiểm tra concurrency 4 và deadline 10 giây nhưng chưa mô hình hóa rõ end-to-end queue time, tile strategy, CPU và memory.
- Corpus đã có 180 fixture và 19.200 labeled words khi verify manifest, nhưng release accuracy chỉ có giá trị khi truyền result inference thật; manifest-only không chứng minh model hiện tại đạt gate.

## 4. Nguyên tắc thiết kế

1. **Zero-recognition detection gate:** full-image detection quyết định có chạy tile hay không; recognition chỉ chạy đúng một lần sau khi tập polygon cuối cùng đã được merge.
2. **Một request, hai mốc thời gian nội bộ:** giữ hard deadline OCR engine/transport 10 giây, nhưng Python phải dừng tính toán sớm hơn để còn thời gian merge/serialize và Node nhận response.
3. **Batch trước, thread sau:** ưu tiên model batching; chỉ tăng thread khi profiling chứng minh có lợi.
4. **Giữ tọa độ gốc:** mọi polygon từ tile phải được chuyển về hệ tọa độ normalized image trước khi deduplicate.
5. **Không nối text thô từ bốn tile:** kết quả phải được merge theo geometry và reading order.
6. **Không phá CV OCR:** mọi logic mới có guard `purpose == JOB_IMAGE_SEARCH`.
7. **Không log nội dung người dùng:** telemetry chỉ chứa số lượng, bucket, strategy version và timing.
8. **Giữ security boundary:** scan sạch trước normalize; UDS private; không tải model lúc runtime; retention 15 phút giữ nguyên.
9. **Đo trước khi đổi model hoặc phần cứng:** model/hardware là giai đoạn sau, không phải bước đầu tiên.

### 4.1 Implementation guardrails bắt buộc

Năm guardrail sau là điều kiện chặn merge/release cho MVP Phase 1, không chỉ là gợi ý tối ưu:

| Guardrail                    | Quyết định bắt buộc                                                                                                                                                                | Cách chứng minh                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PaddleX detector batch shape | Mọi tile trong cùng batch phải có canonical `height × width × channels`; ưu tiên shift tile biên vào trong, nếu vẫn lệch thì letterbox pad phải/dưới và loại polygon trong padding | Adapter test trên PaddleX/ONNX được pin, shape assertion trước inference, test batch 1/2/4    |
| Recognition crop margin      | Mở rộng crop 2–4px hoặc theo line height, clamp trong ảnh và cap theo khoảng cách dòng lân cận; không thay đổi polygon evidence                                                    | Fixture có dấu tiếng Việt và ascender/descender sát biên; xác nhận không ăn sang dòng kế bên  |
| Blank-image fast-fail        | Chỉ fast-fail ảnh gần như trống khi nhiều tín hiệu đồng thuận; `0 box`, edge density hoặc Laplacian variance riêng lẻ không đủ                                                     | 100% recall trên toàn bộ fixture có chữ; ảnh không chắc chắn vẫn chạy tiled recovery          |
| Python/Node timeout parity   | Python compute cutoff phải sớm hơn Node transport hard deadline 750–1.000ms; hard deadline end-to-end vẫn là 10 giây                                                               | Test valid `partial: true` được nhận sát deadline, không thành `ECONNRESET`/`OCR_UNAVAILABLE` |
| Boundary fragment handling   | MVP không string-stitch fragment; chọn whole box từ full/tile pass theo coverage, boundary contact và confidence                                                                   | Corpus split-line xác nhận whole-box selection, test không concatenate hai OCR fragment       |
| Zero-recognition tile gate   | Quyết định tile chỉ dùng detection geometry/confidence/cost projection; không recognition rồi quay lại tile                                                                        | Spy test xác nhận recognition được gọi đúng một lần cho cả full-only và tiled path            |
| Dynamic region budget        | Thay quality cap 40 bằng budget theo remaining compute time và merged polygon cost; vẫn giữ hard safety cap chống DoS                                                              | Dense-poster corpus, deadline test và telemetry detected/selected/skipped regions             |
| OCR claim lease              | Giữ invariant lease 30 giây lớn hơn OCR deadline + response + artifact/DB commit margin; chưa dùng heartbeat trong MVP                                                             | Integration test inference sát cutoff vẫn commit trước `leaseExpiresAt`                       |
| Lazy recognition crop        | Chỉ materialize crop của batch sắp infer; giải phóng reference sau batch, không giữ toàn bộ crop cùng lúc                                                                          | RSS/memory peak benchmark trên dense poster và concurrency matrix                             |
| Vertical text isolation      | Tách polygon dọc/xoay thành block riêng, không xen vào row/column ngang                                                                                                            | Fixture vertical banner, deterministic order và intent regression                             |

Nếu muốn dùng Python deadline 10 giây và Node deadline 11–11.5 giây, đó phải là một quyết định sản phẩm/vận hành riêng: cập nhật release gate, performance harness và deadline policy. Cấu hình đó không tương thích với hard deadline 10 giây của plan hiện tại.

### 4.2 Quyết định tham số sau deep-dive

| Tham số/hành vi                 |         Hiện tại | Quyết định cho candidate MVP                                                                      |
| ------------------------------- | ---------------: | ------------------------------------------------------------------------------------------------- |
| Detection side limit            |              640 | Giữ 640 cho full pass và từng tile để cô lập tác động tiling                                      |
| Region ceiling                  |               40 | Dynamic theo remaining time/cost sau merge; hard safety cap khởi đầu tối đa 100 và phải benchmark |
| Recognition batch               |                5 | Giữ 5 cho baseline; chỉ nâng 8 sau khi latency/RSS chứng minh tốt hơn                             |
| Python compute / Node transport | Cùng mốc 10 giây | Python khoảng 9–9.25 giây, Node tối đa 10 giây                                                    |
| OCR claim lease                 |          30 giây | Giữ 30 giây và kiểm chứng invariant; heartbeat chưa cần cho hard deadline hiện tại                |
| Evidence matching               |  Exact `indexOf` | Phase 2 thêm NFKC + case/punctuation normalization có mapping về text gốc                         |

## 5. Thiết kế chi tiết

### 5.1 Normalize ảnh

Giai đoạn đầu giữ nguyên hành vi an toàn hiện tại:

- Auto-rotate theo metadata.
- Flatten nền trắng, chuyển sRGB, xóa metadata.
- Giữ aspect ratio.
- Cạnh dài tối đa 2048px.
- `withoutEnlargement: true` để không tạo chi tiết giả từ ảnh nhỏ.
- Chỉ hỗ trợ ảnh tĩnh PNG/JPEG và vẫn từ chối trailing bytes/animation.

Không tăng 2048 lên 2560/3072 trong cùng release với tiling. Cần cô lập biến số để biết cải thiện đến từ đâu. Sau khi có baseline tiled OCR mới benchmark riêng các mức 2048, 2560 và 3072.

### 5.2 Full-image detection gate

Full-image detection giữ side limit 640 trong release đầu tiên. Nó có hai vai trò:

- Cho ảnh dễ đi thẳng tới region selection và recognition.
- Thu thập tín hiệu để quyết định có cần tile recovery hay không.

Quyết định tile phải hoàn tất 100% tại tầng detection. Không được nhận dạng full pass, xem confidence thấp rồi quay lại tile, vì chu kỳ detection/recognition thứ hai sẽ phá hard deadline. Sau khi gate hoàn tất, recognition chỉ được gọi đúng một lần trên tập region cuối cùng.

### 5.3 Điều kiện kích hoạt tile recovery

Kích hoạt recovery nếu có ít nhất một tín hiệu sau:

- Detector không trả box nào.
- Median normalized box height thấp hơn ngưỡng chữ nhỏ đã hiệu chỉnh bằng corpus.
- Số box chạm ngưỡng vùng hoặc dự báo aspect budget không đủ.
- Phần lớn box có confidence detection thấp.
- Layout có nhiều cột hoặc box phân bố trên nhiều cụm không gian.
- Polygon nhỏ/dày hoặc chạm biên cho thấy full-image downscale có nguy cơ cắt/mất chữ.

Ngưỡng chính thức không được hardcode theo cảm tính. Phase 0 phải xuất phân phối từ corpus, sau đó khóa vào strategy version.

Recognition confidence không phải trigger của tiled recovery. Nếu tập polygon đã được khóa mà recognition vẫn low-confidence, hệ thống trả low-confidence/partial result theo policy; preprocessing/model recovery thuộc phase sau và phải có budget riêng.

#### Fast-fail cho ảnh thực sự không có chữ

Không được coi `0 box` từ fast pass là đủ để fast-fail, vì đây cũng chính là tín hiệu của ảnh có chữ quá nhỏ mà tiled recovery cần cứu.

Cho phép bỏ qua tile recovery chỉ với nhóm ảnh **gần như trống** có độ chắc chắn rất cao, khi đồng thời thỏa các tín hiệu đã được hiệu chỉnh bằng corpus, ví dụ:

- Grayscale variance/contrast rất thấp.
- Edge density rất thấp.
- Entropy rất thấp.
- Không có connected component hoặc vùng tương phản nào có hình học gần giống dòng chữ.

Không dùng riêng Laplacian variance hoặc edge density làm quyết định vì ảnh phong cảnh có thể nhiều cạnh, còn chữ mờ/low-contrast có thể ít cạnh. Gate fast-fail phải đạt 100% recall trên toàn bộ fixture có chữ trước khi được bật. Trường hợp không chắc chắn vẫn chạy tiled recovery.

### 5.4 Chọn lưới tile

Không luôn chia cứng `2x2`:

| Tỷ lệ normalized image | Lưới khởi đầu    |
| ---------------------- | ---------------- |
| 0.75–1.33              | `2x2`            |
| Rộng hơn 1.33          | `2x1` hoặc `3x1` |
| Cao hơn 1.33           | `1x2` hoặc `1x3` |
| Ảnh nhỏ, chữ đã đủ lớn | Không tile       |

Giới hạn release đầu:

- Tối đa 4 tile cho một ảnh.
- Overlap mặc định 15%; benchmark 10%, 15% và 20%.
- Với ảnh đủ lớn, tile cuối được dịch ngược vào trong ảnh để giữ cùng kích thước thay vì cắt thành tile nhỏ hơn vài pixel.
- Nếu vẫn xuất hiện tile biên khác kích thước, pad nền trắng ở cạnh phải/dưới về canonical tile resolution trước khi batch. Không stretch hoặc resize riêng từng tile.
- Mỗi tile có `tileId`, `offsetX`, `offsetY`, `sourceBounds`, `validContentBounds`, `paddedBounds` và `coreBounds`.
- Polygon nằm hoàn toàn trong vùng padding phải bị loại; polygon giao vùng padding phải được clamp về `validContentBounds` trước khi đổi sang tọa độ ảnh gốc.
- Không lưu tile xuống filesystem/storage; tile chỉ tồn tại trong memory của OCR request.

### 5.5 Chiến lược detect/recognize

Phương án ưu tiên:

1. Detect full image.
2. Nếu cần recovery, detect tile theo bounded batch.
3. Chuyển polygon tile về tọa độ ảnh gốc.
4. Hợp nhất polygon full + tile và loại trùng.
5. Crop các vùng cuối cùng từ normalized image gốc.
6. Recognition một lần theo bounded batch trên tập crop đã hợp nhất.

Cách này tốt hơn việc OCR hoàn chỉnh bốn tile độc lập vì:

- Không nhận dạng cùng một dòng nhiều lần nếu detection đã trùng.
- Có thể chia một ngân sách aspect chung.
- Recognition batch hiệu quả hơn nhiều request rời.
- Kết quả giữ một hệ tọa độ và một reading order.

Trước khi gọi detector batch, adapter phải assert tất cả tensor/array có cùng `height × width × channels`. Một adapter test bằng model/runtime được pin phải xác nhận PaddleX có tự pad hay không. Kể cả khi runtime hiện tại tự pad, planner vẫn tạo canonical tile resolution để không phụ thuộc hành vi private/không được bảo đảm của PaddleX.

Nếu API nội bộ của PaddleX không hỗ trợ batched detection ổn định, fallback là chạy tile detection tuần tự hoặc batch 2; không mở bốn request UDS song song.

#### Dynamic region budget sau merge

Baseline trước Phase 1 tính aspect budget theo thời gian nhưng vẫn chặn cứng ở
`SEARCH_MAX_REGIONS_CEILING = 40`. Sau tiling, cap này có thể loại toàn bộ phần
dưới của poster dù còn thời gian; MVP thay bằng budget động với hard safety cap
100.

Candidate MVP phải:

1. Deduplicate polygon full/tile trước khi tính recognition budget.
2. Ước lượng crop aspect/cost trực tiếp từ polygon geometry, chưa materialize crop.
3. Tính số region có thể xử lý từ remaining compute time và cost calibration thực tế.
4. Giữ một hard safety cap chống DoS/memory runaway, khởi đầu tối đa 100 nhưng không coi 100 là target bắt buộc.
5. Chọn region theo spatial coverage và salience có kiểm soát, không đơn giản lấy một số box cố định đầu theo reading order.
6. Đánh dấu `partial: true` và telemetry số region bị bỏ nếu deadline/cost budget không đủ.

Không tăng đồng thời region cap, recognition batch và OCR deadline trong cùng experiment. Mỗi thay đổi phải có report quality-latency-memory độc lập.

#### Lazy crop và quyền sở hữu bộ nhớ

Không gọi `_crop_by_polys` cho toàn bộ 60–100 polygon rồi giữ tất cả NumPy array trong memory. Sau khi region selection hoàn tất:

1. Chỉ giữ polygon/estimated geometry metadata.
2. Materialize crop từ normalized image gốc ngay trước từng recognition batch.
3. Infer batch, chuyển kết quả sang cấu trúc line nhỏ gọn rồi giải phóng reference tới crop batch.
4. Giới hạn tổng decoded crop bytes cho mỗi batch và ghi nhận RSS peak trong benchmark.

Không ép `gc.collect()` sau mọi batch trong MVP vì có thể tăng latency; chỉ thêm explicit collection nếu profiling chứng minh allocator fragmentation không tự hạ sau khi reference được giải phóng.

### 5.6 Deadline budget

Hard deadline end-to-end 10 giây giữ nguyên. Ngân sách khởi đầu để benchmark:

| Phần                                 | Ngân sách mục tiêu |
| ------------------------------------ | -----------------: |
| Decode trong engine + full detection |           2.0 giây |
| Tile planning + tile detection       |           2.5 giây |
| Recognition                          |           4.0 giây |
| Merge + validate                     |           0.4 giây |
| Serialize + UDS response             |           0.6 giây |
| Safety/transport margin              |           0.5 giây |

Tổng ở bảng là budget mục tiêu, không phải phép cộng cứng cho mọi request. Mỗi batch phải kiểm tra remaining time trước khi chạy. Khi ngân sách thấp:

- Dừng nhận thêm region.
- Giữ tập line tốt nhất đã có.
- Trả `partial: true` thay vì vượt deadline.
- Không để tile recovery làm mất full-image detection candidate hợp lệ hơn.

#### Đồng bộ Python compute deadline và Node transport deadline

Code hiện tại dùng cùng một `input.deadline` cho ba việc: header `X-OCR-Deadline`, timeout của `boundedRequest` và outer abort trong `ocr-stage.ts`. Điều này tạo race ở sát giây thứ 10: Python có thể đang serialize partial payload trong lúc Node đóng socket.

Thiết kế mới phải tách hai mốc nội bộ:

- **Stage/transport hard deadline:** vẫn là `startedAt + 10 giây`, bị cap bởi `deleteBy`; Node không chờ quá mốc này.
- **Python compute deadline:** sớm hơn hard deadline khoảng 750–1.000 ms; được gửi trong `X-OCR-Deadline` để engine dừng detection/recognition, merge kết quả hiện có và serialize response.

Không tăng hard deadline thành 11–11.5 giây vì sẽ phá release gate 10 giây và semantics hiện tại. Thay vào đó, internal `OcrRecognitionRequest`/adapter cần biểu diễn riêng compute deadline và transport deadline, hoặc có response-grace được validate theo purpose. `JOB_IMAGE_SEARCH` dùng grace; `CV_IMPORT` không được thay đổi ngầm.

Nếu Python chạm compute deadline nhưng đã có line hợp lệ, phải trả `200` với `partial: true`; `422 DEADLINE_EXCEEDED` chỉ dùng khi không thể tạo payload hợp lệ. Node phải phân loại timeout transport khác với engine no-text/unavailable và có test cho trường hợp response về ngay trước hard deadline.

#### Lease và commit budget

CodeGraph xác nhận worker hiện claim mỗi stage với lease mặc định 30 giây, trong khi OCR engine hard deadline là 10 giây. Vì vậy không tăng lease hoặc thêm heartbeat một cách mặc định trong MVP; thay vào đó khóa invariant:

```text
leaseMs >= OCR transport deadline
         + maximum artifact encryption/storage/DB commit budget
         + operational margin
```

Giá trị 30 giây hiện tại phải được kiểm chứng bằng integration/performance test có inference sát compute cutoff, response sát transport deadline và storage/transaction chậm có kiểm soát. Trước khi commit, `assertCommitAllowed` và điều kiện `leaseExpiresAt > commitNow` tiếp tục là hàng rào chống stale worker.

Chỉ triển khai heartbeat/lease renewal nếu tương lai tăng hard deadline, thêm preprocessing nặng hoặc benchmark chứng minh tổng thời gian hợp lệ có thể tiến gần 30 giây. Heartbeat phải fenced theo `leaseOwner`, không được hồi sinh query đã cancel, expire hoặc mất consent.

### 5.7 Chuyển tọa độ và deduplicate

Với mỗi polygon trong tile:

1. Cộng `offsetX/offsetY` vào tất cả điểm.
2. Clamp vào normalized image bounds.
3. Từ chối polygon suy biến hoặc ngoài bounds.
4. Tạo bounding rectangle phục vụ indexing nhanh; polygon gốc vẫn là nguồn sự thật.

Trước khi crop vùng recognition từ normalized image gốc, mở rộng crop rectangle bằng margin nhỏ để tránh mất dấu tiếng Việt, ascender/descender hoặc nét chữ sát biên tile:

- Khởi đầu benchmark 2–4px trên ảnh normalized.
- Ưu tiên margin thích nghi theo line height, có min/max và cap theo khoảng cách tới dòng lân cận.
- Vertical padding có thể lớn hơn horizontal padding, nhưng không được lấn sâu sang dòng kế bên.
- Clamp crop mở rộng vào image bounds.
- Polygon trả ra contract vẫn là geometry detection/merge đã xác thực; expansion chỉ phục vụ recognition crop, không làm giả evidence geometry.

Deduplicate theo hai lớp:

- **Geometry candidate:** IoU hoặc overlap theo diện tích vượt ngưỡng; hoặc centroid rất gần và chiều cao tương đương.
- **Text decision:** sau recognition, so sánh NFKC + case-fold + normalized whitespace; dùng exact match trước, similarity có kiểm soát sau.

Quy tắc giữ line:

- Ưu tiên line không bị chạm biên tile.
- Sau đó ưu tiên confidence cao hơn.
- Nếu confidence gần nhau, ưu tiên text đầy đủ hơn và polygon có coverage hợp lý hơn.
- MVP Phase 1 **không string-concatenate fragment**. Ưu tiên candidate nguyên vẹn từ full pass hoặc tile có coverage/confidence tốt hơn; loại candidate bị cắt dựa trên boundary contact, containment và `coreBounds`.

Để tránh duplicate ngay từ đầu, mỗi tile có `coreBounds`: line nằm hoàn toàn trong overlap chỉ được tile sở hữu centroid giữ lại, trừ khi candidate khác chứng minh line bị cắt.

Fragment joining chỉ được xem xét ở phase sau nếu corpus chứng minh overlap + whole-box selection vẫn bỏ sót đáng kể. Khi đó phải có ground truth riêng cho split-line và không được ghép chỉ bằng khoảng cách hoặc string similarity.

### 5.8 Reading order

Không đơn giản sort toàn bộ theo `y` rồi `x`. Poster có thể có nhiều cột.

Thứ tự đề xuất:

1. Tính dominant angle, width/height ratio và baseline của mỗi polygon.
2. Phân loại horizontal, vertical và ambiguous bằng ngưỡng được hiệu chỉnh; khởi đầu thử nghiệm `|angle| <= 30°` cho horizontal và `|angle| >= 60°` cho vertical.
3. Gom horizontal line thành row theo overlap dọc và median line height.
4. Phát hiện column cluster theo khoảng trống ngang lớn.
5. Gom vertical polygon theo cạnh trái/phải, hướng xoay và khoảng cách thành `VERTICAL_SIDEBAR_BLOCK` riêng.
6. Đọc nội dung horizontal theo column từ trái sang phải, trong column từ trên xuống dưới.
7. Đặt vertical block sau primary horizontal content với section break ổn định; không xen ký tự/dòng dọc vào giữa row ngang.
8. Ổn định thứ tự bằng block kind, polygon position và deterministic tie-breaker.

Contract ngoài vẫn là danh sách `OcrLine`; `order` được tính lại sau merge.

Phase 1 chỉ giải quyết isolation và ordering cho text dọc đã nhận dạng được. Nếu recognition của crop xoay 90° chưa đạt gate do text-line orientation đang tắt, việc rotate crop/orientation classification được xử lý ở Phase 3, không làm phình MVP.

### 5.9 Quality score và lựa chọn kết quả

Không dùng average confidence làm tín hiệu duy nhất. Tạo score nội bộ từ:

- Line count.
- Average và minimum recognition confidence.
- Tỷ lệ region đã xử lý trên region phát hiện.
- Tỷ lệ line chạm tile boundary.
- Duplicate ratio.
- Recognized character count.
- Tỷ lệ ký tự chữ/số so với ký tự nhiễu.
- Mức độ `partial`.
- Presence của các nhãn tuyển dụng phổ biến như vị trí, địa điểm, kỹ năng, lương.

Full-image và tiled **detection candidates** có thể cùng tồn tại, nhưng sau dedup chỉ có một recognition result. Quality score dùng để đánh dấu review/partial và chọn line trùng, không được quay lại kích hoạt tiling sau recognition.

### 5.10 Tiền xử lý recovery

Không chạy nhiều biến thể cho mọi ảnh. Thứ tự thử nghiệm:

1. Original sRGB normalized image.
2. Grayscale + local contrast cho ảnh low-contrast.
3. Sharpen nhẹ cho ảnh chữ mờ.
4. Deskew khi detector geometry cho thấy baseline nghiêng.
5. Document/text-line orientation chỉ khi phát hiện khả năng xoay.
6. Unwarping chỉ cho ảnh có dấu hiệu phối cảnh và khi còn đủ deadline.

PaddleOCR hỗ trợ riêng document orientation, unwarping và text-line orientation; tài liệu chính thức cũng cho thấy unwarping CPU có chi phí đáng kể, nên nó phải là recovery có điều kiện, không phải mặc định. Xem [PaddleOCR OCR pipeline](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html).

Super-resolution không thuộc MVP. Chỉ cân nhắc sau khi benchmark chứng minh lỗi chủ yếu đến từ chữ có chiều cao pixel quá thấp và chi phí inference chấp nhận được.

### 5.11 Nhận dạng tiếng Việt và model routing

Giữ `PP-OCRv6-medium` trong Phase 1 để đo đúng tác động của tiling. Phase 3 mới benchmark:

- Model hiện tại.
- Recognition model Latin/Vietnamese.
- English-specific recognition model.
- Mobile so với server/medium model.

Tập benchmark phải tách Việt, Anh, song ngữ và lỗi dấu tiếng Việt. PaddleOCR có recognition model Latin đa ngôn ngữ bao gồm tiếng Việt; chỉ đổi model nếu corpus SmartHire chứng minh cải thiện và không phá English/bilingual. Xem [PP-OCR multilingual recognition](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html).

Mọi model mới phải:

- Được pin version và checksum.
- Có artifact trong model manifest.
- Không tải network lúc runtime.
- Có supply-chain verification.
- Có regression suite riêng cho cả `JOB_IMAGE_SEARCH` và `CV_IMPORT` nếu dùng chung model.

### 5.12 Intent extraction sau OCR

Chất lượng sản phẩm không dừng ở OCR text. Cần nâng cấp bước OCR -> intent theo thứ tự:

1. Deterministic parser cho nhãn phổ biến: `Vị trí`, `Position`, `Job title`, `Địa điểm`, `Location`, `Kỹ năng`, `Requirements`, `Mức lương`, `Salary`.
2. Chuẩn hóa Unicode, khoảng trắng, dấu câu và case nhưng vẫn giữ mapping về code-point range của text gốc.
3. Evidence resolver hai tầng:
   - Exact substring như hiện tại.
   - Normalized/fuzzy match có ngưỡng cao và audit reason rõ ràng.
4. Taxonomy-aware mapping cho job title, skill và location từ catalog candidate-visible hiện có.
5. Không auto-select proposal suy đoán hoặc fuzzy nếu confidence chưa đạt ngưỡng an toàn.
6. Manual criteria của người dùng tiếp tục được ưu tiên như chính sách hiện tại.

Không gửi ảnh sang OpenAI. Chỉ OCR text đã qua retention/consent boundary mới được interpreter xử lý như hiện tại.

### 5.13 Concurrency và hiệu năng

Cấu hình hiện tại có OCR container 4 CPU, ONNX intra-op 4 và image worker concurrency 4. Nếu bốn tile hoặc bốn image request cùng inference, CPU có thể bị oversubscribe.

Ma trận benchmark bắt buộc:

| Inflight OCR request | Tile detection batch | Intra-op | Inter-op |
| -------------------: | -------------------: | -------: | -------: |
|                    1 |                    1 |        4 |        1 |
|                    1 |                    2 |        4 |        1 |
|                    1 |                    4 |        4 |        1 |
|                    2 |                    1 |        2 |        1 |
|                    2 |                    2 |        2 |        1 |
|                    4 |                    1 |        1 |        1 |

Khởi điểm production-safe cho CPU 4 core:

- Một OCR request active trong engine hoặc semaphore rất nhỏ.
- Tile detection batch tối đa 2.
- ONNX intra-op 4 cho một request; chỉ giảm khi cho phép nhiều request đồng thời.
- Recognition batch giữ 5 cho baseline rồi benchmark 8 và 10.

ONNX Runtime khuyến nghị profiling và benchmark thread setting vì tăng thread có thể tăng contention. Xem [thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html) và [profiling tools](https://onnxruntime.ai/docs/performance/tune-performance/profiling-tools.html).

Sau khi CPU path ổn định mới thử:

- Offline graph optimization, phải khóa theo target execution provider.
- OpenVINO cho Intel CPU.
- CUDA/TensorRT nếu production có NVIDIA GPU.
- DirectML chỉ cho môi trường Windows phù hợp, không dùng làm chuẩn production nếu server khác nền tảng.

Tham khảo [ONNX graph optimization](https://onnxruntime.ai/docs/performance/model-optimizations/graph-optimizations.html) và [execution providers](https://onnxruntime.ai/docs/execution-providers/).

### 5.14 Telemetry an toàn

Thêm structured metrics, tuyệt đối không chứa ảnh, OCR text, filename, user ID thô hoặc polygon chi tiết:

- `strategyVersion`.
- `path`: `FULL_ONLY`, `TILED_RECOVERY`, `PREPROCESS_RECOVERY`.
- `normalizedDimensionBucket`.
- `fullDetectedRegionBucket`.
- `tileCount` và `tileBatchSize`.
- `mergedRegionBucket`.
- `duplicateCountBucket`.
- `boundaryFragmentBucket`.
- `partial`.
- `detectMsBucket`, `recognizeMsBucket`, `mergeMsBucket`, `queueMsBucket`.
- `deadlineExitStage` nếu partial/deadline.
- `intentProposalCountBucket` và `validatedIntentOutcome`.

Telemetry phải đi qua schema strict hiện tại; khi thêm field cần version hóa event schema hoặc thêm optional enum/bucket có giới hạn. Không dùng free-form reason từ engine.

### 5.15 Error taxonomy và UX

Tách các trạng thái sau:

- `OCR_NO_TEXT`: không phát hiện text sau full + recovery.
- `OCR_LOW_CONFIDENCE`: có text nhưng chưa đủ tin cậy.
- `OCR_PARTIAL`: có text hữu ích nhưng hết budget/vùng.
- `OCR_DEADLINE_EXCEEDED`: engine hết hard deadline.
- `OCR_UNAVAILABLE`: engine/model/socket thật sự không sẵn sàng.
- `INTENT_NOT_FOUND`: OCR thành công nhưng không tạo được tiêu chí.
- `NO_MATCHING_JOBS`: intent hợp lệ nhưng catalog hiện không có kết quả.

Frontend nên đưa hành động phù hợp:

- Gợi ý crop/rotate khi không có text.
- Cho người dùng xem và chỉnh keyword an toàn khi OCR partial/low confidence.
- Cho phép tiếp tục tìm thủ công mà không mất criteria đang nhập.
- Không hiển thị lỗi kỹ thuật hoặc thông tin hạ tầng.

#### Trạng thái của manual keyword edit

Trong Phase 2 MVP, keyword người dùng chỉnh sửa chỉ tồn tại trong client state của interaction hiện tại:

- Không ghi đè hoặc cập nhật artifact `OCR_TEXT`.
- Không thay đổi polygon, confidence, warning hoặc evidence OCR gốc.
- Khi người dùng Apply, keyword đã chỉnh được chuyển thành criteria tìm Jobs thông thường và mang provenance `USER_EDITED`, không giả là `OCR_EXTRACTED`.
- Cancel, criteria change, page hide hoặc hết interaction sẽ xóa draft theo lifecycle hiện tại.

Nếu sau này cần resume đa thiết bị/server-side, phải lưu thành record/artifact riêng như `USER_EDITED_SEARCH_CRITERIA`, liên kết với query, TTL tối đa 15 phút và immutable audit trail riêng. Không bao giờ mutate `OCR_TEXT` hoặc `VALIDATED_INTENT` gốc.

## 6. Contract, persistence và versioning

### 6.1 Phase 1 không thay đổi

- Public REST endpoints image search.
- State machine `SCAN -> DECODE -> OCR -> INTERPRET`.
- Artifact kinds và mã hóa storage.
- Database schema.
- `ocr-lines-v1` response shape.
- Retention 15 phút.
- OpenAI consent và privacy boundary.

### 6.2 Version cần cập nhật khi triển khai

- Bump OCR engine version để phân biệt hành vi inference mới, đề xuất `1.1.0`.
- Thêm strategy version, đề xuất `search-ocr-adaptive-tiles-v1`.
- Cập nhật model manifest checksum dù weights không đổi nếu manifest chứa engine version.
- Cập nhật expected engine/model metadata ở Node configuration, Compose, tests và supply-chain checks.
- Chỉ bump `ocr-lines-v2` nếu thực sự cần trả thêm field qua UDS. Phase 1 được thiết kế để không cần việc này.
- Việc tách compute/transport deadline là internal adapter contract, không phải public REST contract; phải cập nhật cả caller image search và regression test caller CV.

## 7. Kế hoạch triển khai theo giai đoạn

### Phase 0 — Baseline và khả năng đo lường

**Mục tiêu:** Có bằng chứng định lượng trước khi đổi thuật toán.

Tasks:

- Tạo collector chạy toàn bộ 180 fixture qua engine thật và sinh `smarthire-ocr-corpus-results-v1`.
- Tách báo cáo riêng `JOB_POSTER`, `CV`, language, layout và quality strata.
- Thêm metric cho zero-text, line recall, job-title recall, supported-intent accuracy.
- Nâng performance report lên schema mới có queue-to-actionable end-to-end, CPU và memory.
- Chạy baseline tối thiểu 1 cold + 100 warm samples ở concurrency 1, 2 và 4.
- Lưu hardware fingerprint, engine version, model hash, strategy version, RSS peak và crop-byte peak trong report.
- Bổ sung fixture poster chữ nhỏ, đường chia tile, tiêu đề dài, hai cột, ba cột và ảnh dọc/rộng.

**Acceptance:** Có report baseline tái lập được; manifest-only không được dùng làm accuracy evidence.

### Phase 1 — Adaptive tiling MVP

**Mục tiêu:** Cải thiện recall chữ nhỏ mà giữ contract và deadline.

Tasks:

- Tách `_recognize_search` thành các bước detect, plan, merge, select region và recognize dễ unit test.
- Thêm zero-recognition full-detection gate và recovery decision; recognition phải được gọi đúng một lần.
- Thêm conservative near-blank fast-fail với corpus gate không false-negative text-bearing fixture.
- Thêm tile planner theo aspect ratio, tối đa 4 tile, overlap cấu hình được.
- Chuẩn hóa tile resolution bằng shift-inward hoặc right/bottom padding; thêm shape guard trước detector batch.
- Thêm coordinate transform và bounds validation.
- Thêm geometry dedup trước recognition.
- Thay hard quality cap 40 bằng dynamic post-merge region budget có hard safety cap và spatial coverage.
- Chuyển sang lazy crop theo recognition batch; không materialize toàn bộ crop list.
- Thêm adaptive crop expansion 2–4px/line-height-aware trước recognition.
- Recognition một lần trên region đã hợp nhất.
- Thêm post-recognition text dedup, vertical block isolation và deterministic reading order; không fragment concatenation trong MVP.
- Duy trì time/aspect budget, partial semantics và hard deadline.
- Tách Python compute deadline khỏi Node transport hard deadline và kiểm chứng late-partial response.
- Kiểm chứng lease 30 giây bao phủ inference sát cutoff và artifact/DB commit; không thêm heartbeat nếu invariant vẫn đạt.
- Thêm feature flag để rollback tức thì về strategy hiện tại.
- Bump engine/strategy version và cập nhật manifest/checksum.

**Acceptance:** Đạt toàn bộ quality, performance, security và CV regression gates ở mục 2.

### Phase 2 — Intent resilience và UX recovery

**Mục tiêu:** OCR đã đọc được phải chuyển thành tìm kiếm hữu ích với tỷ lệ cao hơn.

Tasks:

- Duy trì failure mapping riêng cho no-text/partial/deadline ở status và UI; phần
  backend mapping tối thiểu đã hoàn tất trong Phase 1, còn UX hiển thị chi tiết vẫn
  thuộc Phase 2.
- Thêm deterministic label parser.
- Thêm normalized evidence resolver có mapping về code-point range gốc.
- Thêm taxonomy-aware title/skill/location mapping.
- Giữ fuzzy proposal ở trạng thái user-review trừ khi có bằng chứng mạnh.
- Hiển thị trạng thái OCR/intent/no-results riêng biệt.
- Cho chỉnh keyword OCR partial mà không lộ raw artifact ngoài retention/consent policy.
- Giữ keyword edit trong client state; Apply tạo criteria provenance `USER_EDITED`, không mutate artifact OCR/intent.

**Acceptance:** Supported-intent accuracy không dưới 90%, tỷ lệ proposal bị loại vì evidence giảm nhưng false positive không tăng vượt baseline cho phép.

### Phase 3 — Preprocessing và model benchmark

**Mục tiêu:** Xử lý ảnh xoay, méo, low contrast và tiếng Việt khó.

Tasks:

- Thử deskew và orientation recovery có điều kiện.
- Benchmark rotate-crop/text-line orientation cho `VERTICAL_SIDEBAR_BLOCK` nếu Phase 1 chưa nhận dạng text dọc đạt gate.
- Benchmark grayscale/contrast/sharpen variants theo strata.
- Benchmark unwarping riêng vì chi phí CPU cao.
- Benchmark model current/Latin/English/mobile/server trên cùng corpus.
- Chỉ chọn model/variant thắng theo Pareto quality-latency-memory.

**Acceptance:** Mỗi thay đổi có report độc lập; không gộp nhiều biến làm mất khả năng xác định nguyên nhân.

### Phase 4 — Runtime optimization

**Mục tiêu:** Giảm p95 dưới tải sau khi thuật toán ổn định.

Tasks:

- Bật ONNX operator/thread profiling trong môi trường benchmark, không bật production mặc định.
- Chọn inflight/thread/batch matrix tối ưu.
- Thử offline graph optimization.
- Đánh giá OpenVINO hoặc GPU execution provider theo hạ tầng thật.
- Chỉ tăng số OCR process khi memory model, thread safety và queue fairness đã được đo.

**Acceptance:** p95 giảm ít nhất 25% so với tiled baseline mà accuracy không giảm và resource peak nằm trong container limit.

## 8. File impact dự kiến

### Thay đổi chính

| File/khu vực                                                                       | Mục đích                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ocr-engine/src/engine.py`                                                         | Tile planner, detect/merge, deadline budget, reading order, bounded batching |
| `ocr-engine/src/contracts.py`                                                      | Chỉ đổi nếu cần version/strategy metadata; ưu tiên giữ contract              |
| `ocr-engine/src/app.py`                                                            | Concurrency guard, safe timing/strategy telemetry nếu cần                    |
| `ocr-engine/model-manifest.json`                                                   | Engine/strategy traceability và checksum                                     |
| `ocr-engine/tests/test_engine.py`                                                  | Unit test tile geometry, overlap, dedup, deadline, order, CV isolation       |
| `ocr-engine/tests/test_contract.py`                                                | Contract parity và backward compatibility                                    |
| `web/src/backend/ocr/ocr-engine.ts`                                                | Internal compute/transport deadline contract                                 |
| `web/src/backend/ocr/unix-ocr-engine.ts`                                           | Transport grace, socket lifecycle và timeout mapping                         |
| `web/src/backend/image-search/workers/ocr-stage.ts`                                | Failure mapping, strategy telemetry, giữ fallback/commit semantics           |
| `web/src/backend/image-search/workers/runtime.ts`                                  | Xác nhận lease/concurrency invariant; chỉ đổi nếu benchmark yêu cầu          |
| `web/src/backend/repositories/image-search/prisma-image-search-work-repository.ts` | Fenced lease/commit tests; heartbeat chỉ nếu scope tương lai yêu cầu         |
| `web/src/backend/image-search/telemetry.ts`                                        | Safe strategy/timing/count buckets                                           |
| `web/src/backend/image-search/config.ts`                                           | Feature flag/version validation nếu Node cần biết strategy                   |
| `compose.yaml`                                                                     | Engine version/flag và runtime tuning                                        |

### Thay đổi Phase 2

| File/khu vực                                                                     | Mục đích                                              |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `web/src/backend/image-search/interpretation/selection-policy.ts`                | Normalized evidence và confidence policy              |
| `web/src/backend/services/image-search/validate-search-intent.ts`                | Deterministic + external interpretation orchestration |
| `web/src/backend/services/jobs/job-search-taxonomy.ts`                           | Taxonomy-aware mapping từ candidate-visible catalog   |
| `web/src/frontend/features/jobs/image-search/client/use-image-search.ts`         | Phân biệt fallback/error reason                       |
| `web/src/frontend/features/jobs/image-search/components/global-image-search.tsx` | Crop/rotate/keyword review và thông báo cụ thể        |

### Test và benchmark

| File/khu vực                                            | Mục đích                                                 |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `web/tests/fixtures/ocr-corpus/`                        | Fixture tile-boundary, tiny text, multi-column, recovery |
| `web/scripts/evaluate-ocr-corpus.mjs`                   | Báo cáo theo purpose/strata và recall mới                |
| `web/scripts/measure-image-search-performance.mjs`      | End-to-end performance schema v2                         |
| `web/tests/backend/unit/image-search/ocr-stage.test.ts` | No-text/partial/deadline/failure mapping                 |
| `web/tests/performance/ocr-image-search/`               | Quality và latency gates                                 |
| `web/tests/backend/integration/image-search/`           | State, artifacts, retry, cleanup, stale lease            |
| `web/tests/system/e2e/ocr-image-search/`                | Hành vi người dùng và recovery UX                        |
| `web/tests/security/ocr-image-search/`                  | Content leak, malformed input, isolation, retention      |

Không sửa generated Prisma files. Phase 1 không yêu cầu migration.

## 9. Test plan

### 9.1 Python unit tests

- Tile grid cho square/wide/tall image.
- Canonical tile shape, shift-inward, right/bottom padding và padded-region rejection.
- Overlap và `coreBounds` chính xác tại mọi biên.
- Local-to-global polygon transform.
- Polygon clamp và reject geometry suy biến.
- Duplicate full-vs-tile, tile-vs-tile và nested box.
- Dynamic region budget vượt 40 khi còn thời gian, dừng trước compute cutoff và giữ spatial coverage.
- Line chạm boundary, long line và duplicate text confidence khác nhau.
- Crop expansion giữ dấu tiếng Việt nhưng không ăn sang dòng kế bên.
- Whole-box selection thắng fragment; xác nhận MVP không concatenate fragment.
- Reading order một cột, hai cột, ba cột và vertical sidebar trái/phải.
- Vertical block không xen vào horizontal rows; ambiguous angle có deterministic fallback.
- Recovery trigger/no-trigger.
- Spy test xác nhận recognition chỉ chạy một lần và recognition confidence không thể kích hoạt tile.
- Near-blank fast-fail và text-bearing false-negative gate.
- Deadline trước detection, giữa tile batch và giữa recognition batch.
- Compute deadline dừng sớm, partial serialize thành công trước transport hard deadline.
- Partial result không làm mất line đã nhận dạng.
- `CV_IMPORT` không gọi bất kỳ tile-search helper nào.

### 9.2 Contract tests

- `ocr-lines-v1` vẫn parse được ở Node.
- Width/height/decodedPixels và polygon bounds nhất quán.
- Line ID/order duy nhất sau merge.
- Summary line count, UTF-8 bytes và confidence khớp lines.
- Unknown fields vẫn bị từ chối nếu contract strict.

### 9.3 Integration tests

- Một normalized artifact tạo đúng một OCR text artifact.
- Không có tile artifact tồn tại trong database/storage.
- Lease mất hoặc consent bị revoke vẫn discard kết quả stale.
- Cleanup xóa đủ source/normalized/OCR/intent artifacts.
- No-text, low-confidence, partial, deadline và unavailable đi đúng state/failure code.
- Socket không bị đóng trước một valid partial response trong transport grace window.
- Inference sát compute cutoff cộng storage/DB delay vẫn commit trước lease 30 giây.
- Stale lease vẫn bị discard; heartbeat không xuất hiện trong MVP path.
- Tiling bị tắt cho phép rollback mà không đổi dữ liệu.
- Manual keyword edit không mutate `OCR_TEXT`/`VALIDATED_INTENT` và bị xóa theo client lifecycle.

### 9.4 Corpus tests

Tối thiểu bổ sung:

- 20 poster chữ nhỏ ở chính giữa đường chia tile.
- 10 poster hai cột và 10 poster ba cột.
- 10 tiêu đề dài vượt vùng/crop thông thường.
- 10 ảnh dọc và 10 ảnh rất rộng.
- 10 poster có vertical banner hoặc text xoay 90° ở cạnh trái/phải.
- 10 ảnh low contrast, 10 ảnh nghiêng và 10 ảnh nén mạnh.
- Phân bổ cân bằng Việt/Anh/song ngữ.

Mỗi fixture phải tuân thủ policy hiện tại: synthetic hoặc license được allowlist, checksum cố định, truth NFC UTF-8 và reviewer độc lập. Không đưa ảnh người dùng/production vào repository.

### 9.5 Performance tests

Chạy trên cùng hardware, model image và dataset:

1. Baseline hiện tại.
2. Full detection side 640, tile disabled.
3. Adaptive tile overlap 10%.
4. Adaptive tile overlap 15%.
5. Adaptive tile overlap 20%.
6. Tile-only để xác định upper bound, không phải candidate production.

Mỗi cấu hình chạy ít nhất:

- 1 cold sample.
- 100 warm samples.
- Concurrency 1, 2 và 4.
- Nhóm ảnh easy, tiny-text, dense, multi-column và no-text.
- Dense poster có 40, 60, 80 và 100 merged region candidates để đo quality/latency/RSS.
- Báo cáo RSS peak, crop-byte peak và số region detected/selected/skipped.

### 9.6 Regression commands dự kiến

```powershell
npm run typecheck
npm run test:ocr-image-search
npm run test:cv-import
npm run ocr:test
npm run ocr:supply-chain
npm run ocr:corpus:evaluate -- --results <measured-results.json>
npm run perf:image-search -- --input <measured-performance.json>
npm run test:ocr-image-search:e2e
```

Các command corpus/performance chỉ có giá trị release khi input được thu từ engine thật và report ghi `releaseEvidenceEligible: true`.

## 10. Rollout và rollback

### 10.1 Feature flags đề xuất

- `OCR_SEARCH_ADAPTIVE_TILING_ENABLED`.
- `OCR_SEARCH_TILE_OVERLAP_PERCENT`.
- `OCR_SEARCH_TILE_BATCH_SIZE`.
- `OCR_SEARCH_MAX_TILES`.
- `OCR_SEARCH_STRATEGY_VERSION`.

Các flag phải được validate theo allowlist/range; không cho client nhìn thấy và không dùng `NEXT_PUBLIC_*`.

### 10.2 Rollout

1. Local + CI corpus.
2. Shadow benchmark offline, không ảnh hưởng user result.
3. Canary 5% request đủ điều kiện.
4. 25%, 50%, 100% nếu gate 24 giờ liên tiếp đạt.
5. Mỗi bước so sánh zero-text, partial, intent success, p95, CPU và memory với control.

### 10.3 Auto-rollback triggers

- Error rate tăng hơn 1 điểm phần trăm tuyệt đối.
- p95 tăng hơn 20% so với control.
- Deadline-exceeded tăng hơn 0.5 điểm phần trăm.
- Container memory vượt 80% limit kéo dài.
- Security hoặc CV regression test thất bại.
- Intent false-positive vượt tolerance đã khóa trong baseline.

Rollback chỉ cần tắt adaptive tiling hoặc quay về OCR engine image trước đó vì public contract và database không đổi.

## 11. Rủi ro và biện pháp kiểm soát

| Rủi ro                         | Tác động                   | Kiểm soát                                             |
| ------------------------------ | -------------------------- | ----------------------------------------------------- |
| Tile cắt đôi dòng              | Text thiếu/sai intent      | Overlap, boundary ownership, giữ full detection       |
| Tile batch khác shape          | Detector lỗi/sai tensor    | Canonical shape, padding guard, adapter probe         |
| Crop quá sát polygon           | Mất dấu/nét chữ            | Adaptive expansion, clamp, neighbor-gap cap           |
| Fast-fail quá mạnh             | Bỏ sót chữ mờ/nhỏ          | Multi-signal, high precision, 100% text recall gate   |
| Đọc trùng                      | Interpreter nhận text lặp  | Geometry + normalized text dedup                      |
| Sai reading order              | Nhãn ghép sai giá trị      | Column clustering và deterministic order              |
| Text dọc xen vào dòng ngang    | Intent/context bị nhiễu    | Angle classification, vertical sidebar block          |
| Bốn tile làm chậm hơn          | Vượt 10 giây               | Adaptive trigger, batch, deadline budget              |
| CPU oversubscription           | p95 tăng dưới tải          | Semaphore, matrix benchmark, tune intra-op            |
| Memory tăng/phân mảnh          | OCR container OOM          | Lazy batch crop, byte cap, RSS benchmark              |
| Region cap bỏ phần dưới poster | Mất nội dung quan trọng    | Dynamic budget, spatial coverage, safety cap          |
| Lease hết trước commit         | Công OCR bị stale-discard  | 30s invariant test, fenced commit, heartbeat deferred |
| Fuzzy evidence quá rộng        | Proposal sai               | Ngưỡng cao, user review, audit reason                 |
| Model mới phá tiếng Anh/CV     | Regression                 | Tách phase, corpus theo purpose/language              |
| Telemetry lộ nội dung          | Privacy incident           | Chỉ enum/count/time bucket, schema strict             |
| Internal PaddleX API thay đổi  | Runtime break              | Pin package/model, adapter test và supply-chain gate  |
| Node đóng socket sát deadline  | Mất valid partial payload  | Compute cutoff sớm, transport hard deadline riêng     |
| Manual edit làm sai audit      | Mất tính bất biến evidence | Client draft/provenance riêng, không mutate artifact  |

## 12. Những việc không thuộc phạm vi MVP

- Reverse-image/vector search trực tiếp từ hình ảnh.
- Gửi ảnh gốc hoặc tile sang OpenAI.
- Thay malware scanner hoặc retention policy.
- Thay database schema/state machine.
- Lưu tile lâu dài.
- Bật super-resolution cho mọi ảnh.
- Bắt buộc GPU trước khi CPU path được đo và tối ưu.
- Áp dụng tiling cho `CV_IMPORT`.

## 13. Thứ tự công việc còn lại sau Phase 1 code

1. Thu baseline và candidate report từ engine thật, sửa mọi sai lệch của performance measurement semantics nếu có.
2. Chạy corpus quality, performance, security, integration và CV regression trong CI/container có Python, Docker và database.
3. Kiểm chứng lease 30 giây với inference/commit sát cutoff; xác nhận không stale-discard valid work.
4. So sánh baseline/full-only/adaptive 10/15/20/tile-only ở concurrency 1, 2 và 4; chỉ chốt overlap sau measured evidence.
5. Canary adaptive tiling sau khi mọi release gate đạt; mặc định hiện tại vẫn flag-off.
6. Sau khi tiling ổn định mới nâng intent evidence/taxonomy và UX recovery ở Phase 2.
7. Cuối cùng mới thử preprocessing nặng, model khác và execution provider khác.

## 14. Definition of Done

- CodeGraph blast radius đã được kiểm tra lại sau implementation.
- Không có public API hoặc DB migration ngoài quyết định đã duyệt.
- Tiling chỉ hoạt động cho `JOB_IMAGE_SEARCH`.
- Không lưu/log ảnh tile hoặc OCR text ngoài artifact policy hiện tại.
- Full, tiled, partial, no-text và deadline paths đều có unit/integration test.
- Tile decision hoàn tất trước recognition; mỗi request chỉ có một recognition phase.
- Dynamic region budget không còn quality cap cố định 40 và vẫn có hard safety cap.
- Crop được materialize theo batch; memory/RSS gate đạt dưới concurrency công bố.
- Lease 30 giây được chứng minh bao phủ OCR response và commit, không stale-discard valid work.
- Vertical text được cô lập khỏi horizontal reading order; orientation limitation được ghi nhận rõ.
- Mọi detector batch có canonical shape hoặc fallback tuần tự được kiểm chứng.
- Không fragment string concatenation trong MVP; whole-box selection có corpus evidence.
- Manual keyword edit không mutate audit artifacts và có provenance `USER_EDITED`.
- Corpus report là kết quả inference thật và đạt tất cả release gates.
- Performance report có queue-to-actionable end-to-end và đạt gate dưới concurrency đã công bố.
- Security, retention, consent, stale lease và cleanup tests pass.
- Toàn bộ `CV_IMPORT` regression suite pass.
- Feature flag rollback được kiểm chứng trước rollout.
- Engine/model/strategy version và checksum được ghi nhận đầy đủ trong release evidence.

### 14.1. Implementation record và phần còn chờ đo

| Hạng mục | Trạng thái | Bằng chứng/giới hạn |
| --- | --- | --- |
| Detection gate, adaptive recovery, tile planner, overlap/core ownership, local-to-global polygon transform | Đã implement | `ocr-engine/src/engine.py`; chỉ chạy khi `purpose == JOB_IMAGE_SEARCH` và flag bật |
| Geometry merge, whole-box preference, text dedup, column/vertical reading order | Đã implement | Merge hoàn tất trước crop; không nối fragment string |
| Dynamic region budget, hard safety cap 100, lazy crop batches, crop byte cap | Đã implement | Có telemetry bucket nội bộ; chưa có RSS đo trên engine thật |
| Python compute cutoff và Node transport hard deadline | Đã implement | `computeDeadline` tách khỏi `deadline`; search giữ grace 900ms; CV truyền hai mốc bằng nhau |
| Error mapping no-text/partial/deadline và server-only flags | Đã implement | Không đổi endpoint, artifact schema hoặc DB migration |
| Engine/manifest/config pin | Đã implement | Engine `1.1.0`, strategy `search-ocr-adaptive-tiles-v1`, manifest SHA-256 `a8f8b2e10b1870bd35f1ec7a160399f5d4c6a6c6326c373abf01d7fdc9e38bba` |
| Performance harness queue-to-actionable, concurrency matrix, CPU/RSS/region fields | Đã implement | Schema `image-search-performance-v2`; self-test chỉ kiểm tra hình dạng dữ liệu, không phải inference evidence |
| Python unit/integration, real corpus, security/CV regression, lease sát cutoff | Chưa xác nhận | Checkout thiếu Python và Docker; cần chạy trong CI/container có dependencies và database |
| Release gates, canary, flag-on rollout | Chưa bật | Chỉ được quyết định sau khi có measured report với `releaseEvidenceEligible: true` |

Các lệnh xác nhận hiện tại:

```powershell
# Run the first command from the repository root.
npm run ocr:supply-chain
Set-Location web
npm exec vitest run tests/backend/unit/image-search/config.test.ts tests/backend/unit/image-search/ocr-stage.test.ts tests/backend/unit/ocr/unix-ocr-engine.test.ts tests/shared/unit/contracts/jobs/image-search-contracts.test.ts tests/performance/ocr-image-search/performance-harness.test.ts --passWithNoTests
node scripts/measure-image-search-performance.mjs --self-test
```

Kết quả rà soát ngày 2026-08-27: targeted Vitest pass (5 file, 21 test); Prettier,
ESLint trên các file thay đổi thuộc `web` workspace, `node --check` cho script và
`git diff --check` pass. `ocr:supply-chain`
pass; performance self-test pass nhưng giữ `releaseEvidenceEligible: false`. OCR
regression suite rộng chạy 47 file, đạt 156/159 test và còn đúng 3 failure baseline
ở admission/source-architecture/worker supervision; CV suite rộng đã chạy nhưng còn
failure baseline hoặc thiếu Docker/DB (58 file, 365 pass, 12 failure, 2 skipped).
`env:check` chỉ còn 4 failure thuộc Docker/Compose; `typecheck` chỉ còn lỗi có sẵn ở
admin job-post-reviews. Python và Docker chưa có trong môi trường nên các gate engine
thật, corpus, RSS/CPU và lease chưa được xác nhận.

`npm run typecheck` đã đi qua các file OCR/search mới nhưng toàn repository vẫn
đang có lỗi có sẵn ở `src/frontend/features/admin/job-post-reviews/job-post-review-list.tsx`
(component nhận prop `label` không khai báo). Lỗi này không thuộc thay đổi OCR và
không được đánh dấu là đã sửa trong MVP.

## 15. Tài liệu và source liên quan

### Source hiện tại

- `web/src/backend/ocr/image-normalizer.ts`
- `web/src/backend/image-search/workers/ocr-stage.ts`
- `web/src/backend/image-search/workers/runtime.ts`
- `web/src/backend/image-search/interpretation/selection-policy.ts`
- `web/src/backend/image-search/telemetry.ts`
- `web/src/backend/ocr/policies.ts`
- `ocr-engine/src/engine.py`
- `ocr-engine/src/app.py`
- `ocr-engine/src/contracts.py`
- `web/scripts/evaluate-ocr-corpus.mjs`
- `web/scripts/measure-image-search-performance.mjs`

### Tài liệu kỹ thuật chính thức

- [PaddleOCR OCR pipeline](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html)
- [PaddleOCR multilingual recognition](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html)
- [ONNX Runtime thread management](https://onnxruntime.ai/docs/performance/tune-performance/threading.html)
- [ONNX Runtime profiling](https://onnxruntime.ai/docs/performance/tune-performance/profiling-tools.html)
- [ONNX Runtime graph optimization](https://onnxruntime.ai/docs/performance/model-optimizations/graph-optimizations.html)
- [ONNX Runtime execution providers](https://onnxruntime.ai/docs/execution-providers/)
