import Link from "next/link";

export const metadata = {
  title: "Chính sách phân tích CV bằng AI · SmartHire",
  description:
    "Chính sách độc lập của SmartHire về việc phân tích mức độ phù hợp giữa CV và vị trí ứng tuyển.",
};

export default function AiCvAnalysisPolicyPage() {
  return (
    <main className="jobs-page">
      <article className="job-panel job-policy-page">
        <Link className="job-detail-back" href="/jobs">
          ← Quay lại danh sách việc làm
        </Link>
        <p className="panel-kicker">SMART HIRE POLICY</p>
        <h1>Chính sách phân tích CV bằng AI</h1>
        <p>
          SmartHire có thể dùng AI để tạo một nhận định tham khảo về mức độ phù
          hợp giữa CV của bạn và vị trí bạn đang ứng tuyển. Đây là nội dung độc
          lập của SmartHire và được công bố riêng trên nền tảng này.
        </p>

        <h2>1. AI được dùng để làm gì?</h2>
        <p>
          Khi bạn chủ động bật lựa chọn đồng ý, SmartHire phân tích các kỹ năng,
          kinh nghiệm và thông tin nghề nghiệp có trong CV để đưa ra điểm phù
          hợp và phần giải thích ngắn. Kết quả chỉ mang tính tham khảo, không
          phải quyết định tuyển dụng.
        </p>

        <h2>2. Quyền lựa chọn của bạn</h2>
        <p>
          Đồng ý phân tích AI là tùy chọn và không phải điều kiện để ứng tuyển.
          Nếu không đồng ý, hồ sơ vẫn được gửi tới nhà tuyển dụng bình thường;
          SmartHire chỉ không tạo điểm hoặc gợi ý phù hợp bằng AI cho lần ứng
          tuyển đó.
        </p>

        <h2>3. Dữ liệu và minh bạch</h2>
        <p>
          SmartHire chỉ sử dụng CV và vị trí ứng tuyển trong phạm vi cần thiết
          cho mục đích đã thông báo. Kết quả được gắn với lần ứng tuyển, không
          thay đổi nội dung CV và không được dùng để tự động loại ứng viên. Bạn
          có thể liên hệ SmartHire để hỏi về kết quả hoặc yêu cầu hỗ trợ thủ
          công.
        </p>

        <h2>4. Liên hệ</h2>
        <p>
          Nếu bạn có câu hỏi về chính sách này, hãy liên hệ đội ngũ hỗ trợ
          SmartHire từ trang tài khoản của bạn.
        </p>
        <p className="job-form-help">Phiên bản chính sách: 2026-08-05.</p>
      </article>
    </main>
  );
}
