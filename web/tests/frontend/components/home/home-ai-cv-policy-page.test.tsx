import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeAiCvPolicyPage } from "@/frontend/features/home/components/home-ai-cv-policy-page";

describe("HomeAiCvPolicyPage", () => {
  it("renders the Vietnamese policy with transparent safeguards and useful exits", () => {
    const { container } = render(<HomeAiCvPolicyPage />);

    expect(
      screen.getByRole("heading", { name: "Chính sách phân tích CV bằng AI" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(7);
    expect(screen.getByText("Tùy chọn tự nguyện")).toBeInTheDocument();
    expect(screen.getByText("Không tự động loại")).toBeInTheDocument();
    expect(screen.getByText("Bảo mật nguyên vẹn")).toBeInTheDocument();
    expect(
      screen.getByText(/Kết quả đánh giá chỉ mang tính tham khảo/u),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Quay lại trang chủ" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: /Mở trung tâm hỗ trợ tài khoản/u }),
    ).toHaveAttribute("href", "/help");
    expect(within(container).getAllByRole("article")).toHaveLength(1);
  });
});
