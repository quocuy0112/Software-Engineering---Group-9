export type EmployerVerificationLocale = "vi" | "en";

export const employerVerificationCopy = (
  locale: EmployerVerificationLocale,
) =>
  locale === "vi"
    ? {
        kicker: "EMAIL CÔNG TY",
        title: "Xác minh hộp thư công ty",
        description:
          "Thao tác này xác nhận quyền kiểm soát hộp thư cho yêu cầu xác minh nhà tuyển dụng của bạn.",
        checking: "Đang kiểm tra liên kết xác minh…",
        signInRequired:
          "Hãy đăng nhập bằng tài khoản Ứng viên đã yêu cầu liên kết này, sau đó quay lại và thử lại.",
        openSignIn: "Mở trang đăng nhập trong tab mới",
        retry: "Thử lại xác minh",
        invalid:
          "Liên kết không hợp lệ, đã hết hạn, đã được sử dụng hoặc thuộc về tài khoản khác. Hãy yêu cầu liên kết mới từ trang xác minh nhà tuyển dụng.",
        returnToVerification: "Trở về trang xác minh",
        retryable:
          "Không thể hoàn tất xác minh. Hãy kiểm tra kết nối rồi thử lại.",
      }
    : {
        kicker: "COMPANY EMAIL",
        title: "Verify company mailbox",
        description:
          "This confirms mailbox control for your employer verification request.",
        checking: "Checking your verification link…",
        signInRequired:
          "Sign in as the Candidate who requested this link, then return here and retry.",
        openSignIn: "Open sign in in a new tab",
        retry: "Retry verification",
        invalid:
          "This link is invalid, expired, already used, or belongs to another account. Request a new link from the employer verification page.",
        returnToVerification: "Return to verification",
        retryable:
          "Verification could not be completed. Check your connection and try again.",
      };
