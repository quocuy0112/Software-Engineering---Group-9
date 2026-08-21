import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export function recruiterJobPostingCopy(locale: WorkspaceLocale) {
  return locale === "vi"
    ? {
        back: "Quay lại tất cả tin tuyển dụng",
        create: "Tạo tin tuyển dụng",
        edit: "Chỉnh sửa tin tuyển dụng",
        savedManually: "Bản nháp được lưu thủ công",
        saving: "Đang lưu bản nháp",
        saved: "Đã lưu bản nháp",
        unsaved: "Có thay đổi chưa lưu",
        ready: "Sẵn sàng",
        inProgress: "Đang thực hiện",
        completed: (completed: number) => `${completed} / 6 phần đã sẵn sàng`,
        completion: (completed: number) =>
          `${Math.round((completed / 6) * 100)}% hoàn thành`,
        progressHelp:
          "Lưu bản nháp khi các trường cốt lõi đã sẵn sàng; thêm hạn nộp trước khi gửi duyệt.",
        livePreview: "Xem trước cho ứng viên",
        livePreviewHelp: "Cập nhật từ dữ liệu biểu mẫu hiện tại",
        livePreviewStatus: "Đồng bộ",
        negotiable: "Thương lượng",
        aboutRole: "Về vai trò",
        requiredSkills: "Kỹ năng cần có",
        hiringSpecs: "Thông tin tuyển dụng",
        experience: "Kinh nghiệm",
        education: "Học vấn",
        openSeats: "Vị trí tuyển",
        noSkills: "Thêm kỹ năng để thể hiện yêu cầu cho ứng viên.",
        noOverview:
          "Tổng quan về vai trò sẽ xuất hiện khi bạn hoàn thiện biểu mẫu.",
        noPitch: "Giới thiệu ngắn sẽ xuất hiện ở đây.",
        yourJobTitle: "Vị trí của bạn",
        experienceDetail: (label: string, minYears: number) =>
          `${label} (tối thiểu ${minYears} năm)`,
        openPositions: (count: number) => `${count} vị trí`,
      }
    : {
        back: "Back to all job postings",
        create: "Create job posting",
        edit: "Edit job posting",
        savedManually: "Drafts are saved manually",
        saving: "Saving draft",
        saved: "Draft saved",
        unsaved: "Unsaved changes",
        ready: "Ready",
        inProgress: "In progress",
        completed: (completed: number) => `${completed} of 6 sections ready`,
        completion: (completed: number) =>
          `${Math.round((completed / 6) * 100)}% completed`,
        progressHelp:
          "Save a draft after the core required fields are ready; add a deadline before submission.",
        livePreview: "Live candidate preview",
        livePreviewHelp: "Updates from the current form data",
        livePreviewStatus: "Synchronized",
        negotiable: "Negotiable",
        aboutRole: "About the role",
        requiredSkills: "Required skills",
        hiringSpecs: "Hiring specs",
        experience: "Experience",
        education: "Education",
        openSeats: "Open seats",
        noSkills: "Add skills to showcase candidate requirements.",
        noOverview: "Your overview will appear here as you complete the form.",
        noPitch: "Your short pitch will appear here.",
        yourJobTitle: "Your job title",
        experienceDetail: (label: string, minYears: number) =>
          `${label} (min ${minYears} yrs)`,
        openPositions: (count: number) =>
          `${count} ${count === 1 ? "position" : "positions"}`,
      };
}
