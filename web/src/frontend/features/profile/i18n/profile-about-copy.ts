export type ProfileAboutLocale = "vi" | "en";

export type ProfileAboutCopy = {
  pageKicker: string;
  pageTitle: string;
  pageSubtitle: string;
  loading: string;
  loadError: string;
  retry: string;
  autoSave: string;
  kicker: string;
  title: string;
  description: string;
  privacy: string;
  dateOfBirth: string;
  preferredName: string;
  interests: string;
  bio: string;
  notAdded: string;
  edit: string;
  cancel: string;
  save: string;
  saving: string;
  optional: string;
  dateHint: string;
  bioHint: string;
};

const vietnameseCopy: ProfileAboutCopy = {
  pageKicker: "THÔNG TIN RIÊNG TƯ",
  pageTitle: "Về bạn",
  pageSubtitle: "Quản lý những thông tin cá nhân chỉ hiển thị với bạn.",
  loading: "Đang tải…",
  loadError: "Không thể tải thông tin riêng tư của bạn.",
  retry: "Thử lại",
  autoSave: "Tự động lưu",
  kicker: "RIÊNG TƯ",
  title: "Về bạn",
  description: "Một vài nét cá nhân chỉ hiển thị với bạn.",
  privacy:
    "Thông tin này không dùng cho Smart Match hoặc hồ sơ công khai.",
  dateOfBirth: "Ngày sinh",
  preferredName: "Tên muốn được gọi",
  interests: "Sở thích",
  bio: "Giới thiệu ngắn",
  notAdded: "Chưa thêm",
  edit: "Chỉnh sửa",
  cancel: "Hủy",
  save: "Lưu thông tin",
  saving: "Đang lưu…",
  optional: "Tùy chọn",
  dateHint: "Định dạng ngày-tháng-năm",
  bioHint: "Tối đa 1.000 ký tự",
};

const englishCopy: ProfileAboutCopy = {
  pageKicker: "PRIVATE DETAILS",
  pageTitle: "About me",
  pageSubtitle: "Manage personal details that are visible only to you.",
  loading: "Loading…",
  loadError: "Unable to load your private details.",
  retry: "Try again",
  autoSave: "Auto-save",
  kicker: "PRIVATE",
  title: "About you",
  description: "A few personal details visible only to you.",
  privacy:
    "This information is not used for Smart Match or your public profile.",
  dateOfBirth: "Date of birth",
  preferredName: "Name you'd like to use",
  interests: "Interests",
  bio: "Short introduction",
  notAdded: "Not added",
  edit: "Edit",
  cancel: "Cancel",
  save: "Save details",
  saving: "Saving…",
  optional: "Optional",
  dateHint: "Use the date picker format",
  bioHint: "Up to 1,000 characters",
};

export function profileAboutCopy(locale: ProfileAboutLocale): ProfileAboutCopy {
  return locale === "vi" ? vietnameseCopy : englishCopy;
}
