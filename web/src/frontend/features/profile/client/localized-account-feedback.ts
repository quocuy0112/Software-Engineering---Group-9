import type { FieldErrors } from "@/shared/contracts/account/common";

type Locale = "vi" | "en";

const vietnameseMessages: Record<string, string> = {
  "Account identity saved.": "Đã lưu thông tin tài khoản.",
  "Preferences saved.": "Đã lưu tùy chọn.",
  "Profile section saved.": "Đã lưu mục hồ sơ.",
  "Profile photo saved.": "Đã lưu ảnh đại diện.",
  "Profile photo removed.": "Đã xóa ảnh đại diện.",
  "Choose a valid PNG or JPEG photo and try again.":
    "Hãy chọn ảnh PNG hoặc JPEG hợp lệ rồi thử lại.",
  "Password changed. Other sessions were signed out.":
    "Đã đổi mật khẩu và đăng xuất các phiên khác.",
  "Verification instructions were queued for the proposed address.":
    "Đã gửi hướng dẫn xác minh đến địa chỉ email mới.",
  "Review the highlighted fields.": "Hãy kiểm tra các trường được đánh dấu.",
  "Review the complete preference set.": "Hãy kiểm tra lại toàn bộ tùy chọn.",
  "Enter a valid value.": "Hãy nhập giá trị hợp lệ.",
  "Enter a valid full name.": "Hãy nhập họ tên hợp lệ.",
  "Choose a supported timezone.": "Hãy chọn múi giờ được hỗ trợ.",
  "This account cannot perform that action.":
    "Tài khoản này không thể thực hiện thao tác đó.",
  "The current password is incorrect.": "Mật khẩu hiện tại không chính xác.",
  "Enter the current password for this account.":
    "Hãy nhập mật khẩu hiện tại của tài khoản.",
  "Too many incorrect current-password attempts. Try again later.":
    "Có quá nhiều lần nhập sai mật khẩu hiện tại. Hãy thử lại sau.",
  "Refresh the page before starting a different password change.":
    "Hãy tải lại trang trước khi bắt đầu một lần đổi mật khẩu khác.",
  "Refresh the page and try again from the initiating session.":
    "Hãy tải lại trang và thử lại từ phiên đã bắt đầu thao tác.",
  "The password change could not be completed. Try again.":
    "Không thể hoàn tất việc đổi mật khẩu. Hãy thử lại.",
  "Provide a valid request identity and try again.":
    "Yêu cầu không hợp lệ. Hãy thử lại.",
  "Please confirm your current password to continue.":
    "Hãy xác nhận mật khẩu hiện tại để tiếp tục.",
  "Authentication required.": "Phiên đăng nhập đã hết hạn.",
  "Try again later.": "Hãy thử lại sau.",
  "That email address cannot be used.": "Không thể sử dụng địa chỉ email này.",
  "Refresh the page before trying a different address.":
    "Hãy tải lại trang trước khi thử một địa chỉ khác.",
  "One or more profile items could not be updated.":
    "Không thể cập nhật một hoặc nhiều mục trong hồ sơ.",
  "Saved. Another session had a newer profile revision, so this valid update replaced it.":
    "Đã lưu. Một phiên khác có phiên bản hồ sơ mới hơn nên cập nhật hợp lệ này đã thay thế phiên bản đó.",
  "Unsafe or empty content was removed.":
    "Nội dung không an toàn hoặc trống đã được loại bỏ.",
};

const vietnameseByCode: Record<string, string> = {
  ACCOUNT_TIMEZONE_UNSUPPORTED: "Hãy chọn múi giờ được hỗ trợ.",
  ACCOUNT_UNAVAILABLE: "Tài khoản này không thể thực hiện thao tác đó.",
  CURRENT_PASSWORD_INVALID: "Mật khẩu hiện tại không chính xác.",
  EMAIL_ADDRESS_UNAVAILABLE: "Không thể sử dụng địa chỉ email này.",
  IDEMPOTENCY_CONFLICT: "Dữ liệu thao tác đã thay đổi. Hãy tải lại trang.",
  PASSWORD_CHANGE_INCOMPLETE:
    "Không thể hoàn tất việc đổi mật khẩu. Hãy thử lại.",
  PASSWORD_CHANGE_LOCKED:
    "Đổi mật khẩu tạm thời bị khóa do có quá nhiều lần thử.",
  PROFILE_ITEM_NOT_OWNED: "Không thể cập nhật một hoặc nhiều mục trong hồ sơ.",
  RATE_LIMITED: "Có quá nhiều yêu cầu. Hãy thử lại sau.",
  RECENT_AUTH_REQUIRED: "Hãy xác nhận mật khẩu hiện tại để tiếp tục.",
  REQUEST_FORBIDDEN: "Yêu cầu không còn hiệu lực. Hãy tải lại trang.",
  VALIDATION_ERROR: "Hãy kiểm tra các trường được đánh dấu.",
};

export function localizeAccountMessage(
  locale: Locale,
  message: string,
  code?: string,
) {
  if (locale === "en") return message;
  return (
    (code ? vietnameseByCode[code] : undefined) ??
    vietnameseMessages[message] ??
    "Không thể hoàn tất thao tác. Hãy thử lại."
  );
}

export function localizeFieldErrors(locale: Locale, fieldErrors?: FieldErrors) {
  if (locale === "en" || !fieldErrors) return fieldErrors;
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [
      field,
      messages.map(
        (message) =>
          vietnameseMessages[message] ?? "Hãy kiểm tra lại giá trị này.",
      ),
    ]),
  );
}
