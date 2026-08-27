export type AuthLocale = "vi" | "en";

export type AuthCopy = {
  shell: {
    about: string;
    eyebrow: string;
    title: string;
    description: string;
    protection: string;
    secure: string;
    note: string;
    emailVerified: string;
    twoFactor: string;
    profile: string;
    navigation: string;
    signIn: string;
    createAccount: string;
    forgotPassword: string;
    panelNote: string;
  };
  footer: {
    haveAccount: string;
    needAccount: string;
    signIn: string;
    signUp: string;
  };
  common: {
    emailAddress: string;
    emailPlaceholder: string;
    backToSignIn: string;
    returnToSignIn: string;
    reviewForm: string;
    passwordRequirements: (label: string) => string;
    hidePassword: string;
    showPassword: string;
  };
  login: {
    kicker: string;
    title: string;
    description: string;
    password: string;
    passwordHint: string;
    forgotPassword: string;
    signingIn: string;
    signIn: string;
    genericError: string;
    unexpectedError: string;
    suspended: string;
    contactSupport: string;
    locked: (minutes: number) => string;
    attemptsRemaining: (message: string, remaining: number) => string;
  };
  register: {
    kicker: string;
    title: string;
    description: string;
    fullName: string;
    password: string;
    confirmPassword: string;
    creating: string;
    create: string;
    submitting: string;
    registrationError: string;
    registrationAttention: string;
    checkEmail: string;
  };
  forgotPassword: {
    kicker: string;
    title: string;
    description: string;
    sending: string;
    send: string;
    lostAccess: string;
    success: string;
    error: string;
  };
  checkEmail: {
    title: string;
    description: string;
    openProvider: (provider: string) => string;
    openInbox: string;
    resending: string;
    resendAvailable: (seconds: number) => string;
    didNotReceive: string;
    clickToResend: string;
    haveAccount: string;
    signIn: string;
    sent: string;
    resendError: string;
  };
  resendVerification: {
    sending: string;
    resend: string;
    sent: string;
    error: string;
  };
  resetPassword: {
    kicker: string;
    title: string;
    description: string;
    newPassword: string;
    confirmPassword: string;
    redirecting: string;
    resetting: string;
    reset: string;
    success: string;
    error: string;
    mismatch: string;
  };
  recovery: {
    requestKicker: string;
    requestTitle: string;
    requestDescription: string;
    requestSuccess: string;
    requestError: string;
    sendInstructions: string;
    sending: string;
    lowerAssurance: string;
    invalidLink: string;
    confirmationKicker: string;
    confirmationTitle: string;
    confirmationDescription: string;
    verifying: string;
    verifyingTitle: string;
    startHold: string;
    startingHold: string;
    holdEndsPrefix: string;
    holdEndsDescription: string;
    confirmationError: string;
    cancellationKicker: string;
    cancellationTitle: string;
    cancellationDescription: string;
    cancelling: string;
    cancel: string;
    cancelled: string;
    cancellationError: string;
    completionKicker: string;
    completionTitle: string;
    completionDescription: string;
    completionSuccess: string;
    completedTitle: string;
    completedDescription: string;
    goToSignIn: string;
    requestNewLink: string;
    completing: string;
    complete: string;
    completionError: string;
  };
  verifyEmail: {
    verifying: string;
    wait: string;
    verified: string;
    verifiedDescription: string;
    continueToLogin: string;
    unavailable: string;
    unavailableDescription: string;
  };
  twoFactor: {
    kicker: string;
    title: string;
    description: string;
    method: string;
    authenticator: string;
    backup: string;
    sixDigit: string;
    authenticationCode: string;
    backupCode: string;
    verifying: string;
    verify: string;
    invalidAuthenticator: (remaining: number) => string;
    invalidBackup: (remaining: number) => string;
    locked: (minutes: number) => string;
    complete: string;
    genericError: string;
  };
  passwordRequirements: {
    atLeast: string;
    atMost: string;
    uppercase: string;
    number: string;
    special: string;
    control: string;
  };
};

const englishCopy: AuthCopy = {
  shell: {
    about: "About SmartHire",
    eyebrow: "YOUR STORY. YOUR NEXT MOVE.",
    title: "Opportunity starts with a story worth seeing.",
    description:
      "Shape a professional identity that feels true to you, while SmartHire keeps every important account action protected.",
    protection: "Account protection",
    secure: "Secure",
    note: "Illustration only — not your account status.",
    emailVerified: "Verify your email",
    twoFactor: "Protect your account with 2FA",
    profile: "Build your professional profile",
    navigation: "Authentication",
    signIn: "Sign in",
    createAccount: "Create account",
    forgotPassword: "Forgot password",
    panelNote: "SmartHire keeps account access simple, transparent, and secure.",
  },
  footer: {
    haveAccount: "Already have an account?",
    needAccount: "Don't have an account yet?",
    signIn: "Sign In",
    signUp: "Sign Up",
  },
  common: {
    emailAddress: "Email address",
    emailPlaceholder: "example@email.com",
    backToSignIn: "Back to sign in",
    returnToSignIn: "Return to sign in",
    reviewForm: "Please review the form",
    passwordRequirements: (label) => `${label} requirements`,
    hidePassword: "Hide password",
    showPassword: "Show password",
  },
  login: {
    kicker: "WELCOME BACK",
    title: "Sign in to SmartHire",
    description: "Continue to your secure talent workspace.",
    password: "Password",
    passwordHint:
      "Use 12–128 characters, including an uppercase letter, a number, and a special character.",
    forgotPassword: "Forgot password?",
    signingIn: "Signing in…",
    signIn: "Sign in",
    genericError: "Email or password is incorrect.",
    unexpectedError: "Something went wrong. Please try again.",
    suspended: "This account is suspended.",
    contactSupport: "Contact support or submit a dispute",
    locked: (minutes) =>
      `Your account has been temporarily locked after too many failed sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    attemptsRemaining: (message, remaining) =>
      `${message} (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
  },
  register: {
    kicker: "START YOUR JOURNEY",
    title: "Create your SmartHire account",
    description: "All accounts begin with a Candidate identity.",
    fullName: "Full name",
    password: "Password",
    confirmPassword: "Confirm password",
    creating: "Creating account…",
    create: "Create account",
    submitting: "Submitting securely.",
    registrationError: "Registration is temporarily unavailable. Please try again.",
    registrationAttention: "Registration needs attention.",
    checkEmail: "Check your email.",
  },
  forgotPassword: {
    kicker: "ACCOUNT RECOVERY",
    title: "Forgot your password?",
    description:
      "Enter your email and we’ll send reset instructions if the account is eligible.",
    sending: "Sending…",
    send: "Send reset instructions",
    lostAccess: "Lost your password and access to two-factor authentication?",
    success: "Password-reset instructions will be sent to this email.",
    error: "We couldn't send password-reset instructions. Please try again.",
  },
  checkEmail: {
    title: "Check your email",
    description:
      "If the address can be registered, a verification link has been sent to:",
    openProvider: (provider) => `Open ${provider}`,
    openInbox: "Open email inbox",
    resending: "Resending verification email…",
    resendAvailable: (seconds) => `Resend available in ${seconds}s`,
    didNotReceive: "Didn't receive an email?",
    clickToResend: "Click to resend",
    haveAccount: "Already have an account?",
    signIn: "Sign in →",
    sent: "Verification email sent.",
    resendError: "We couldn't resend the verification email. Please try again.",
  },
  resendVerification: {
    sending: "Sending…",
    resend: "Resend verification",
    sent: "Verification email sent.",
    error: "We couldn't resend the verification email. Please try again.",
  },
  resetPassword: {
    kicker: "SECURE YOUR ACCOUNT",
    title: "Choose a new password",
    description: "Use a strong, unique password you do not use anywhere else.",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    redirecting: "Redirecting to sign in…",
    resetting: "Resetting…",
    reset: "Reset password",
    success: "Your password has been reset. Sign in again.",
    error: "Your password could not be reset. Please try again.",
    mismatch: "Passwords do not match.",
  },
  recovery: {
    requestKicker: "ACCOUNT RECOVERY",
    requestTitle: "Lost access to every factor?",
    requestDescription:
      "Use this separate, lower-assurance process only if you lost your password, TOTP access, and every backup code.",
    requestSuccess: "Account-recovery instructions will be sent to this email.",
    requestError: "The account-recovery request could not be completed. Please try again.",
    sendInstructions: "Send recovery instructions",
    sending: "Sending…",
    lowerAssurance:
      "Email-only recovery is lower assurance than using your password and second factor.",
    invalidLink: "This account-recovery link is invalid, expired, or already used.",
    confirmationKicker: "SECURITY HOLD",
    confirmationTitle: "Recovery request received",
    confirmationDescription:
      "We revoke existing access and start a 24-hour hold before any password or factor change.",
    verifying: "Verifying this secure recovery link…",
    verifyingTitle: "Verifying secure link",
    startHold: "Start 24-hour security hold",
    startingHold: "Starting security hold…",
    holdEndsPrefix: "Hold ends at",
    holdEndsDescription:
      "Check your email for one-time cancellation and completion links.",
    confirmationError: "The recovery request could not be confirmed.",
    cancellationKicker: "RECOVERY CANCELLATION",
    cancellationTitle: "Cancel account recovery",
    cancellationDescription:
      "Cancelling keeps your existing password and second factor, while previously revoked sessions remain signed out.",
    cancelling: "Cancelling recovery…",
    cancel: "Cancel account recovery",
    cancelled:
      "Recovery was cancelled. Sign in with your existing password and second factor.",
    cancellationError:
      "The account-recovery link is invalid, expired, or already used.",
    completionKicker: "COMPLETE RECOVERY",
    completionTitle: "Choose a new password",
    completionDescription:
      "This step is available only after the 24-hour security hold. Your old TOTP and backup codes will be disabled here.",
    completionSuccess: "Recovery completed. Sign in again.",
    completedTitle: "Sign in again",
    completedDescription: "Re-enroll two-factor authentication after your next login.",
    goToSignIn: "Go to sign in",
    requestNewLink: "Request a new recovery link",
    completing: "Completing…",
    complete: "Complete recovery",
    completionError: "Recovery could not be completed.",
  },
  verifyEmail: {
    verifying: "Verifying your email",
    wait: "Please wait…",
    verified: "Email verified",
    verifiedDescription: "Your account is active. You can now continue to login.",
    continueToLogin: "Continue to login",
    unavailable: "Verification link unavailable",
    unavailableDescription:
      "The link is invalid, expired, already used, or cannot be processed safely.",
  },
  twoFactor: {
    kicker: "VERIFY YOUR IDENTITY",
    title: "Two-factor verification",
    description: "Use your authenticator or one backup code.",
    method: "Verification method",
    authenticator: "Authenticator code",
    backup: "Backup code",
    sixDigit: "Six-digit authentication code",
    authenticationCode: "Authentication code",
    backupCode: "Backup code",
    verifying: "Verifying…",
    verify: "Verify",
    invalidAuthenticator: (remaining) =>
      `That authentication code is invalid. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
    invalidBackup: (remaining) =>
      `That backup code is invalid. (${remaining} attempt${remaining === 1 ? "" : "s"} remaining)`,
    locked: (minutes) =>
      `Too many failed attempts. This verification flow is temporarily locked. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    complete: "Verification complete.",
    genericError: "Verification could not be completed. Sign in and try again.",
  },
  passwordRequirements: {
    atLeast: "At least 12 characters",
    atMost: "No more than 128 characters",
    uppercase: "1 uppercase letter",
    number: "1 number",
    special: "1 special character",
    control: "No control characters",
  },
};

const vietnameseCopy: AuthCopy = {
  shell: {
    about: "Về SmartHire",
    eyebrow: "CÂU CHUYỆN CỦA BẠN. BƯỚC TIẾP THEO CỦA BẠN.",
    title: "Cơ hội bắt đầu từ một câu chuyện đáng được nhìn thấy.",
    description:
      "Xây dựng bản sắc nghề nghiệp chân thật với bạn, trong khi SmartHire bảo vệ mọi thao tác quan trọng trên tài khoản.",
    protection: "Bảo vệ tài khoản",
    secure: "An toàn",
    note: "Minh họa — không phản ánh trạng thái tài khoản của bạn.",
    emailVerified: "Xác thực email",
    twoFactor: "Bảo vệ tài khoản bằng 2FA",
    profile: "Xây dựng hồ sơ chuyên môn",
    navigation: "Xác thực",
    signIn: "Đăng nhập",
    createAccount: "Tạo tài khoản",
    forgotPassword: "Quên mật khẩu",
    panelNote: "SmartHire giúp việc truy cập tài khoản đơn giản, minh bạch và an toàn.",
  },
  footer: {
    haveAccount: "Bạn đã có tài khoản?",
    needAccount: "Bạn chưa có tài khoản?",
    signIn: "Đăng nhập",
    signUp: "Đăng ký",
  },
  common: {
    emailAddress: "Địa chỉ email",
    emailPlaceholder: "example@email.com",
    backToSignIn: "Quay lại đăng nhập",
    returnToSignIn: "Trở về đăng nhập",
    reviewForm: "Vui lòng kiểm tra lại biểu mẫu",
    passwordRequirements: (label) => `Yêu cầu đối với ${label.toLowerCase()}`,
    hidePassword: "Ẩn mật khẩu",
    showPassword: "Hiện mật khẩu",
  },
  login: {
    kicker: "CHÀO MỪNG TRỞ LẠI",
    title: "Đăng nhập vào SmartHire",
    description: "Tiếp tục đến không gian tuyển dụng an toàn của bạn.",
    password: "Mật khẩu",
    passwordHint:
      "Dùng 12–128 ký tự, gồm chữ hoa, chữ số và ký tự đặc biệt.",
    forgotPassword: "Quên mật khẩu?",
    signingIn: "Đang đăng nhập…",
    signIn: "Đăng nhập",
    genericError: "Email hoặc mật khẩu không chính xác.",
    unexpectedError: "Đã xảy ra lỗi. Vui lòng thử lại.",
    suspended: "Tài khoản này đã bị tạm ngưng.",
    contactSupport: "Liên hệ hỗ trợ hoặc gửi khiếu nại",
    locked: (minutes) =>
      `Tài khoản của bạn tạm thời bị khóa do có quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau ${minutes} phút.`,
    attemptsRemaining: (message, remaining) =>
      `${message} (còn ${remaining} lần thử)`,
  },
  register: {
    kicker: "BẮT ĐẦU HÀNH TRÌNH",
    title: "Tạo tài khoản SmartHire",
    description: "Mọi tài khoản đều bắt đầu với danh tính Ứng viên.",
    fullName: "Họ và tên",
    password: "Mật khẩu",
    confirmPassword: "Xác nhận mật khẩu",
    creating: "Đang tạo tài khoản…",
    create: "Tạo tài khoản",
    submitting: "Đang gửi an toàn.",
    registrationError: "Đăng ký hiện chưa khả dụng. Vui lòng thử lại.",
    registrationAttention: "Vui lòng kiểm tra lại thông tin đăng ký.",
    checkEmail: "Hãy kiểm tra email.",
  },
  forgotPassword: {
    kicker: "KHÔI PHỤC TÀI KHOẢN",
    title: "Bạn quên mật khẩu?",
    description:
      "Nhập email và chúng tôi sẽ gửi hướng dẫn đặt lại nếu tài khoản đủ điều kiện.",
    sending: "Đang gửi…",
    send: "Gửi hướng dẫn đặt lại",
    lostAccess: "Bạn mất mật khẩu và không còn quyền truy cập xác thực hai lớp?",
    success: "Hướng dẫn đặt lại mật khẩu sẽ được gửi đến email này.",
    error: "Không thể gửi hướng dẫn đặt lại mật khẩu. Vui lòng thử lại.",
  },
  checkEmail: {
    title: "Hãy kiểm tra email",
    description:
      "Nếu địa chỉ này có thể đăng ký, một liên kết xác thực đã được gửi đến:",
    openProvider: (provider) => `Mở ${provider}`,
    openInbox: "Mở hộp thư email",
    resending: "Đang gửi lại email xác thực…",
    resendAvailable: (seconds) => `Có thể gửi lại sau ${seconds} giây`,
    didNotReceive: "Bạn chưa nhận được email?",
    clickToResend: "Nhấp để gửi lại",
    haveAccount: "Bạn đã có tài khoản?",
    signIn: "Đăng nhập →",
    sent: "Đã gửi email xác thực.",
    resendError: "Không thể gửi lại email xác thực. Vui lòng thử lại.",
  },
  resendVerification: {
    sending: "Đang gửi…",
    resend: "Gửi lại email xác thực",
    sent: "Đã gửi email xác thực.",
    error: "Không thể gửi lại email xác thực. Vui lòng thử lại.",
  },
  resetPassword: {
    kicker: "BẢO VỆ TÀI KHOẢN",
    title: "Chọn mật khẩu mới",
    description: "Dùng một mật khẩu mạnh, riêng biệt và không dùng ở nơi khác.",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Xác nhận mật khẩu mới",
    redirecting: "Đang chuyển đến đăng nhập…",
    resetting: "Đang đặt lại…",
    reset: "Đặt lại mật khẩu",
    success: "Mật khẩu đã được đặt lại. Hãy đăng nhập lại.",
    error: "Không thể đặt lại mật khẩu. Vui lòng thử lại.",
    mismatch: "Mật khẩu không khớp.",
  },
  recovery: {
    requestKicker: "KHÔI PHỤC TÀI KHOẢN",
    requestTitle: "Bạn mất quyền truy cập mọi yếu tố xác thực?",
    requestDescription:
      "Chỉ dùng quy trình có mức đảm bảo thấp hơn này nếu bạn mất mật khẩu, quyền truy cập TOTP và toàn bộ mã dự phòng.",
    requestSuccess: "Hướng dẫn khôi phục tài khoản sẽ được gửi đến email này.",
    requestError: "Không thể hoàn tất yêu cầu khôi phục tài khoản. Vui lòng thử lại.",
    sendInstructions: "Gửi hướng dẫn khôi phục",
    sending: "Đang gửi…",
    lowerAssurance:
      "Khôi phục chỉ bằng email có mức đảm bảo thấp hơn so với dùng mật khẩu và yếu tố xác thực thứ hai.",
    invalidLink: "Liên kết khôi phục tài khoản không hợp lệ, đã hết hạn hoặc đã được sử dụng.",
    confirmationKicker: "TẠM GIỮ BẢO MẬT",
    confirmationTitle: "Đã nhận yêu cầu khôi phục",
    confirmationDescription:
      "Chúng tôi thu hồi quyền truy cập hiện tại và bắt đầu thời gian tạm giữ 24 giờ trước mọi thay đổi mật khẩu hoặc yếu tố xác thực.",
    verifying: "Đang xác minh liên kết khôi phục an toàn…",
    verifyingTitle: "Đang xác minh liên kết an toàn",
    startHold: "Bắt đầu tạm giữ bảo mật 24 giờ",
    startingHold: "Đang bắt đầu tạm giữ bảo mật…",
    holdEndsPrefix: "Thời gian tạm giữ kết thúc lúc",
    holdEndsDescription:
      "Hãy kiểm tra email để nhận liên kết hủy và hoàn tất dùng một lần.",
    confirmationError: "Không thể xác nhận yêu cầu khôi phục.",
    cancellationKicker: "HỦY KHÔI PHỤC",
    cancellationTitle: "Hủy khôi phục tài khoản",
    cancellationDescription:
      "Việc hủy giữ nguyên mật khẩu và yếu tố xác thực hiện tại, đồng thời các phiên đã thu hồi vẫn tiếp tục đăng xuất.",
    cancelling: "Đang hủy khôi phục…",
    cancel: "Hủy khôi phục tài khoản",
    cancelled: "Đã hủy khôi phục. Hãy đăng nhập bằng mật khẩu và yếu tố xác thực hiện tại.",
    cancellationError: "Liên kết khôi phục tài khoản không hợp lệ, đã hết hạn hoặc đã được sử dụng.",
    completionKicker: "HOÀN TẤT KHÔI PHỤC",
    completionTitle: "Chọn mật khẩu mới",
    completionDescription:
      "Bước này chỉ khả dụng sau thời gian tạm giữ bảo mật 24 giờ. TOTP và mã dự phòng cũ sẽ bị vô hiệu hóa tại đây.",
    completionSuccess: "Đã hoàn tất khôi phục. Hãy đăng nhập lại.",
    completedTitle: "Đăng nhập lại",
    completedDescription: "Hãy đăng ký lại xác thực hai lớp sau lần đăng nhập tiếp theo.",
    goToSignIn: "Đến trang đăng nhập",
    requestNewLink: "Yêu cầu liên kết khôi phục mới",
    completing: "Đang hoàn tất…",
    complete: "Hoàn tất khôi phục",
    completionError: "Không thể hoàn tất khôi phục.",
  },
  verifyEmail: {
    verifying: "Đang xác minh email",
    wait: "Vui lòng chờ…",
    verified: "Email đã được xác minh",
    verifiedDescription: "Tài khoản của bạn đã hoạt động. Bạn có thể tiếp tục đăng nhập.",
    continueToLogin: "Tiếp tục đăng nhập",
    unavailable: "Liên kết xác minh không khả dụng",
    unavailableDescription:
      "Liên kết không hợp lệ, đã hết hạn, đã được sử dụng hoặc không thể xử lý an toàn.",
  },
  twoFactor: {
    kicker: "XÁC MINH DANH TÍNH",
    title: "Xác minh hai lớp",
    description: "Dùng ứng dụng xác thực hoặc một mã dự phòng.",
    method: "Phương thức xác minh",
    authenticator: "Mã từ ứng dụng xác thực",
    backup: "Mã dự phòng",
    sixDigit: "Mã xác thực gồm sáu chữ số",
    authenticationCode: "Mã xác thực",
    backupCode: "Mã dự phòng",
    verifying: "Đang xác minh…",
    verify: "Xác minh",
    invalidAuthenticator: (remaining) =>
      `Mã xác thực không hợp lệ. (còn ${remaining} lần thử)`,
    invalidBackup: (remaining) =>
      `Mã dự phòng không hợp lệ. (còn ${remaining} lần thử)`,
    locked: (minutes) =>
      `Có quá nhiều lần thử không thành công. Luồng xác minh tạm thời bị khóa. Vui lòng thử lại sau ${minutes} phút.`,
    complete: "Đã xác minh thành công.",
    genericError: "Không thể hoàn tất xác minh. Hãy đăng nhập và thử lại.",
  },
  passwordRequirements: {
    atLeast: "Ít nhất 12 ký tự",
    atMost: "Không quá 128 ký tự",
    uppercase: "1 chữ cái viết hoa",
    number: "1 chữ số",
    special: "1 ký tự đặc biệt",
    control: "Không có ký tự điều khiển",
  },
};

export function authCopy(locale: AuthLocale): AuthCopy {
  return locale === "vi" ? vietnameseCopy : englishCopy;
}

export function localizedAuthMessage(
  locale: AuthLocale,
  message: string | undefined,
  fallback: string,
) {
  return locale === "en" && message ? message : fallback;
}

export function localizedAuthFieldError(
  locale: AuthLocale,
  field: string,
  message: string | undefined,
) {
  if (locale === "en" || !message) return message;
  if (field === "email") return "Hãy nhập địa chỉ email hợp lệ.";
  if (field === "name") return "Hãy nhập họ và tên.";
  if (field === "currentPassword") return "Hãy nhập mật khẩu hiện tại.";
  if (field === "code" || field === "twoFactorCode") {
    return "Hãy nhập mã xác thực hợp lệ.";
  }
  if (field === "password") return "Hãy nhập mật khẩu hợp lệ.";
  if (field === "passwordConfirmation") return "Mật khẩu xác nhận không khớp.";
  return "Hãy kiểm tra lại thông tin này.";
}
