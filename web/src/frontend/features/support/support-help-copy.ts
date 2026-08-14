import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export type SupportFaqCategory =
  | "account"
  | "profile"
  | "jobs"
  | "match"
  | "connections"
  | "security";

export type SupportFaqEntry = Readonly<{
  id: string;
  category: SupportFaqCategory;
  question: string;
  answer: string;
  keywords: readonly string[];
  action?: Readonly<{ href: string; label: string }>;
}>;

type SupportHelpCopy = Readonly<{
  faq: Readonly<{
    eyebrow: string;
    title: string;
    subtitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    categoriesLabel: string;
    allCategories: string;
    popularHeading: string;
    allHeading: string;
    noResultsTitle: string;
    noResultsCopy: string;
    clearFilters: string;
    createSupportRequest: string;
    feedbackQuestion: string;
    feedbackPositive: string;
    feedbackNegative: string;
  }>;
  categories: Readonly<Record<SupportFaqCategory, string>>;
  questions: readonly SupportFaqEntry[];
  popularQuestionIds: readonly string[];
  recovery: Readonly<{
    eyebrow: string;
    title: string;
    subtitle: string;
    stepsHeading: string;
    steps: readonly Readonly<{ title: string; description: string }>[];
    safetyTitle: string;
    safetyCopy: string;
    resetPassword: string;
    contactSupport: string;
    backToSupport: string;
  }>;
}>;

export function getSupportHelpCopy(locale: WorkspaceLocale): SupportHelpCopy {
  if (locale === "vi") {
    return {
      faq: {
        eyebrow: "TRUNG TÂM TRỢ GIÚP",
        title: "Câu hỏi thường gặp",
        subtitle:
          "Tìm câu trả lời nhanh hoặc tạo yêu cầu hỗ trợ nếu bạn vẫn cần giúp đỡ.",
        searchLabel: "Tìm kiếm câu hỏi thường gặp",
        searchPlaceholder: "Tìm câu hỏi, ví dụ: điểm phù hợp, đổi mật khẩu…",
        categoriesLabel: "Lọc theo danh mục",
        allCategories: "Tất cả",
        popularHeading: "Phổ biến nhất",
        allHeading: "Tất cả câu hỏi",
        noResultsTitle: "Không tìm thấy câu trả lời phù hợp",
        noResultsCopy:
          "Hãy thử một từ khoá khác, nới bộ lọc hoặc gửi yêu cầu để đội ngũ hỗ trợ giúp bạn.",
        clearFilters: "Xoá tìm kiếm và bộ lọc",
        createSupportRequest: "Tạo yêu cầu hỗ trợ",
        feedbackQuestion: "Câu trả lời này hữu ích không?",
        feedbackPositive: "Có, câu trả lời này hữu ích",
        feedbackNegative: "Không, tôi vẫn cần hỗ trợ",
      },
      categories: {
        account: "Tài khoản",
        profile: "Hồ sơ & CV",
        jobs: "Việc làm & Ứng tuyển",
        match: "AI Smart Match",
        connections: "Kết nối & Nhắn tin",
        security: "Bảo mật",
      },
      questions: [
        {
          id: "smart-match-score",
          category: "match",
          question: "Điểm Smart Match được tính như thế nào?",
          answer:
            "Smart Match so sánh thông tin trong hồ sơ và CV với yêu cầu của việc làm, như kỹ năng, kinh nghiệm và học vấn. Điểm này giúp bạn hiểu mức độ phù hợp của hồ sơ với vị trí; đây chỉ là gợi ý và không quyết định kết quả tuyển dụng.",
          keywords: ["điểm", "phù hợp", "ai", "match", "cv", "kỹ năng"],
        },
        {
          id: "smart-match-improve",
          category: "match",
          question: "Làm sao để cải thiện gợi ý Smart Match?",
          answer:
            "Hãy cập nhật kỹ năng, kinh nghiệm, học vấn và CV bằng thông tin chính xác. Hồ sơ đầy đủ hơn giúp Smart Hire so sánh với yêu cầu công việc hiệu quả hơn; không nên thêm kỹ năng hoặc kinh nghiệm bạn không có.",
          keywords: ["cải thiện", "điểm", "hồ sơ", "kinh nghiệm", "kỹ năng"],
          action: { href: "/profile", label: "Cập nhật hồ sơ" },
        },
        {
          id: "application-response",
          category: "jobs",
          question: "Vì sao tôi chưa nhận được phản hồi sau khi ứng tuyển?",
          answer:
            "Thời gian xem xét phụ thuộc vào từng nhà tuyển dụng và mỗi vị trí có thể có quy trình khác nhau. Bạn có thể theo dõi trạng thái đơn ứng tuyển trong Smart Hire, nhưng hệ thống không thể đảm bảo nhà tuyển dụng sẽ phản hồi.",
          keywords: ["phản hồi", "ứng tuyển", "nhà tuyển dụng", "trạng thái"],
          action: { href: "/jobs/applied", label: "Xem đơn ứng tuyển" },
        },
        {
          id: "application-status",
          category: "jobs",
          question: "Tôi xem trạng thái đơn ứng tuyển ở đâu?",
          answer:
            "Mở mục Việc đã ứng tuyển để xem các đơn đã gửi và các cập nhật mà nhà tuyển dụng đã công bố. Chỉ những trạng thái xuất hiện trong từng đơn mới phản ánh tiến trình hiện tại của đơn đó.",
          keywords: ["trạng thái", "đơn", "ứng tuyển", "xem"],
          action: { href: "/jobs/applied", label: "Mở việc đã ứng tuyển" },
        },
        {
          id: "recruiter-connection",
          category: "connections",
          question: "Làm sao để kết nối với nhà tuyển dụng?",
          answer:
            "Kết nối được tạo từ đề xuất của Quản trị viên nền tảng và chỉ có hiệu lực khi cả hai bên đồng ý. Sau khi kết nối được chấp thuận, hai bên có thể nhắn tin riêng trong Smart Hire.",
          keywords: ["kết nối", "nhà tuyển dụng", "nhắn tin", "đồng ý"],
          action: { href: "/connections", label: "Xem kết nối" },
        },
        {
          id: "recruiter-messaging",
          category: "connections",
          question: "Vì sao tôi chưa thể nhắn tin với nhà tuyển dụng?",
          answer:
            "Khả năng nhắn tin phụ thuộc vào kết nối đã được cả hai bên đồng ý. Hãy kiểm tra mục Kết nối để xem quyền nhắn tin có đang hoạt động hay không.",
          keywords: ["nhắn tin", "không thể", "quyền", "kết nối"],
          action: { href: "/connections", label: "Kiểm tra kết nối" },
        },
        {
          id: "update-cv",
          category: "profile",
          question: "Tôi cập nhật hồ sơ hoặc tải CV lên ở đâu?",
          answer:
            "Bạn có thể chỉnh sửa thông tin nghề nghiệp trong mục Hồ sơ. Để Smart Hire đọc CV và đề xuất cập nhật hồ sơ, mở mục Nhập CV rồi xem xét từng đề xuất trước khi áp dụng.",
          keywords: ["cv", "tải lên", "hồ sơ", "cập nhật", "nhập cv"],
          action: { href: "/profile/cv-imports", label: "Mở mục nhập CV" },
        },
        {
          id: "multiple-cvs",
          category: "profile",
          question: "Tôi có thể lưu nhiều phiên bản CV không?",
          answer:
            "Bạn có thể lưu các CV đã xác nhận trong thư viện CV và giữ các lần nhập CV để xem lại trạng thái xử lý. Khi ứng tuyển, hãy chọn CV phù hợp nhất với vị trí và luôn cập nhật nội dung mới nhất.",
          keywords: ["nhiều cv", "phiên bản", "thư viện", "lưu cv"],
          action: { href: "/profile/cv-imports", label: "Quản lý CV" },
        },
        {
          id: "profile-information",
          category: "profile",
          question: "Tôi nên bổ sung thông tin gì vào hồ sơ?",
          answer:
            "Hãy ưu tiên kỹ năng, kinh nghiệm, học vấn, dự án, chứng chỉ và thông tin việc làm bạn quan tâm. Các thông tin chính xác và đầy đủ giúp nhà tuyển dụng hiểu hồ sơ của bạn và giúp gợi ý việc làm sát hơn.",
          keywords: ["thông tin", "hồ sơ", "kỹ năng", "kinh nghiệm", "dự án"],
          action: { href: "/profile", label: "Hoàn thiện hồ sơ" },
        },
        {
          id: "reset-password",
          category: "account",
          question: "Làm sao để đặt lại mật khẩu?",
          answer:
            "Mở trang Quên mật khẩu, nhập email gắn với tài khoản Smart Hire và làm theo hướng dẫn được gửi tới hộp thư. Nếu bạn không còn quyền truy cập email hoặc phương thức bảo mật, hãy dùng hướng dẫn khôi phục tài khoản.",
          keywords: ["mật khẩu", "quên", "đặt lại", "email", "đăng nhập"],
          action: { href: "/forgot-password", label: "Đặt lại mật khẩu" },
        },
        {
          id: "reset-email-missing",
          category: "account",
          question: "Tôi không nhận được email đặt lại mật khẩu thì sao?",
          answer:
            "Trước hết hãy kiểm tra thư rác, xác nhận email đã nhập đúng và chờ một vài phút trước khi thử lại. Nếu vấn đề vẫn tiếp diễn, hãy tạo yêu cầu hỗ trợ và không gửi mật khẩu hoặc mã bảo mật trong nội dung yêu cầu.",
          keywords: ["email", "không nhận", "thư rác", "mật khẩu", "reset"],
          action: { href: "/support", label: "Tạo yêu cầu hỗ trợ" },
        },
        {
          id: "profile-visibility",
          category: "security",
          question: "Ai có thể xem hồ sơ của tôi?",
          answer:
            "Khả năng hiển thị hồ sơ phụ thuộc vào các quyền và bối cảnh sử dụng được thiết lập trong Smart Hire. Bạn nên kiểm tra thông tin hồ sơ trước khi ứng tuyển và chỉ đưa vào những nội dung bạn sẵn sàng chia sẻ trong quá trình tuyển dụng.",
          keywords: ["ai xem", "hồ sơ", "riêng tư", "quyền", "bảo mật"],
          action: { href: "/profile/preferences", label: "Xem tuỳ chọn hồ sơ" },
        },
        {
          id: "suspicious-activity",
          category: "security",
          question: "Tôi nên làm gì khi thấy hoạt động đáng ngờ?",
          answer:
            "Hãy đổi mật khẩu ngay và kiểm tra các phiên đăng nhập đang hoạt động trong phần Bảo mật. Nếu cần hỗ trợ thêm, hãy tạo yêu cầu; đội ngũ hỗ trợ sẽ không bao giờ yêu cầu bạn gửi mật khẩu hoặc mã xác thực.",
          keywords: [
            "đáng ngờ",
            "bảo mật",
            "tài khoản",
            "phiên đăng nhập",
            "mật khẩu",
          ],
          action: { href: "/profile/security", label: "Mở cài đặt bảo mật" },
        },
      ],
      popularQuestionIds: [
        "smart-match-score",
        "application-response",
        "recruiter-connection",
      ],
      recovery: {
        eyebrow: "HỖ TRỢ TÀI KHOẢN",
        title: "Khôi phục tài khoản",
        subtitle:
          "Bắt đầu bằng cách đặt lại mật khẩu. Nếu không còn quyền truy cập email hoặc phương thức bảo mật, đội ngũ hỗ trợ có thể hướng dẫn bước tiếp theo.",
        stepsHeading: "Các bước nên thử trước",
        steps: [
          {
            title: "Dùng tính năng Quên mật khẩu",
            description:
              "Nhập địa chỉ email đang liên kết với tài khoản Smart Hire để nhận hướng dẫn đặt lại mật khẩu.",
          },
          {
            title: "Kiểm tra hộp thư đến và thư rác",
            description:
              "Email có thể mất vài phút để đến. Hãy kiểm tra cả mục Spam hoặc Junk trước khi yêu cầu lại.",
          },
          {
            title: "Xác nhận đúng địa chỉ email",
            description:
              "Dùng chính email bạn đã đăng ký với Smart Hire. Nếu nhập sai, hệ thống không thể gửi hướng dẫn tới tài khoản của bạn.",
          },
          {
            title: "Liên hệ hỗ trợ nếu vẫn không truy cập được",
            description:
              "Tạo yêu cầu hỗ trợ nếu bạn không còn quyền truy cập email hoặc cần trợ giúp sau khi đã thử các bước trên.",
          },
        ],
        safetyTitle: "Giữ tài khoản an toàn",
        safetyCopy:
          "Không gửi mật khẩu, mã xác thực hai lớp hoặc mã dự phòng trong tin nhắn hỗ trợ. Smart Hire sẽ không yêu cầu các thông tin này.",
        resetPassword: "Đặt lại mật khẩu",
        contactSupport: "Liên hệ hỗ trợ",
        backToSupport: "Quay lại Trung tâm hỗ trợ",
      },
    };
  }

  return {
    faq: {
      eyebrow: "HELP CENTER",
      title: "Frequently Asked Questions",
      subtitle:
        "Find a quick answer or create a support request when you still need help.",
      searchLabel: "Search frequently asked questions",
      searchPlaceholder:
        "Search questions, for example: match score, reset password…",
      categoriesLabel: "Filter by category",
      allCategories: "All",
      popularHeading: "Most popular",
      allHeading: "All questions",
      noResultsTitle: "No matching answer found",
      noResultsCopy:
        "Try another keyword, broaden the filter, or send a request so the support team can help.",
      clearFilters: "Clear search and filters",
      createSupportRequest: "Create a support request",
      feedbackQuestion: "Was this answer helpful?",
      feedbackPositive: "Yes, this answer was helpful",
      feedbackNegative: "No, I still need help",
    },
    categories: {
      account: "Account",
      profile: "Profile & CV",
      jobs: "Jobs & Applications",
      match: "AI Smart Match",
      connections: "Connections & Messaging",
      security: "Security",
    },
    questions: [
      {
        id: "smart-match-score",
        category: "match",
        question: "How is my Smart Match score calculated?",
        answer:
          "Smart Match compares information in your profile and CV with job requirements, including skills, experience, and education. The score helps you understand how closely your profile matches a role; it is a recommendation and does not decide a hiring outcome.",
        keywords: ["score", "match", "ai", "cv", "skills", "fit"],
      },
      {
        id: "smart-match-improve",
        category: "match",
        question: "How can I improve my Smart Match suggestions?",
        answer:
          "Keep your skills, work experience, education, and CV accurate and up to date. A more complete profile helps Smart Hire compare it with job requirements more effectively; do not add skills or experience you do not have.",
        keywords: ["improve", "score", "profile", "experience", "skills"],
        action: { href: "/profile", label: "Update profile" },
      },
      {
        id: "application-response",
        category: "jobs",
        question: "Why have I not received a response after applying?",
        answer:
          "Review times depend on each employer and every role can have a different process. You can follow your application status in Smart Hire, but the platform cannot guarantee that an employer will respond.",
        keywords: ["response", "apply", "recruiter", "application", "status"],
        action: { href: "/jobs/applied", label: "View applications" },
      },
      {
        id: "application-status",
        category: "jobs",
        question: "Where can I check my application status?",
        answer:
          "Open My applications to view submitted applications and updates published by the employer. Only statuses shown on an individual application reflect its current progress.",
        keywords: ["status", "application", "check", "submitted"],
        action: { href: "/jobs/applied", label: "Open My applications" },
      },
      {
        id: "recruiter-connection",
        category: "connections",
        question: "How do I connect with a recruiter?",
        answer:
          "Connections are created from a Platform Administrator proposal and become active only after both people accept. Once the connection is accepted, the two people can message privately in Smart Hire.",
        keywords: ["connect", "recruiter", "message", "accept"],
        action: { href: "/connections", label: "View connections" },
      },
      {
        id: "recruiter-messaging",
        category: "connections",
        question: "Why can’t I message a recruiter yet?",
        answer:
          "Messaging access depends on a connection accepted by both people. Check Connections to see whether messaging access is active for that relationship.",
        keywords: ["message", "cannot", "access", "connection"],
        action: { href: "/connections", label: "Check connections" },
      },
      {
        id: "update-cv",
        category: "profile",
        question: "Where can I update my profile or upload a CV?",
        answer:
          "You can edit professional information in Profile. To let Smart Hire read a CV and suggest profile updates, open CV imports and review every suggestion before applying it.",
        keywords: ["cv", "upload", "profile", "update", "import"],
        action: { href: "/profile/cv-imports", label: "Open CV imports" },
      },
      {
        id: "multiple-cvs",
        category: "profile",
        question: "Can I keep more than one CV version?",
        answer:
          "You can retain confirmed CVs in your CV library and keep CV imports to review their processing status. When applying, choose the CV that best fits the role and keep its content current.",
        keywords: ["multiple cv", "versions", "library", "save cv"],
        action: { href: "/profile/cv-imports", label: "Manage CVs" },
      },
      {
        id: "profile-information",
        category: "profile",
        question: "What should I add to my profile?",
        answer:
          "Prioritize skills, experience, education, projects, certifications, and the work you are interested in. Accurate and complete information helps employers understand your profile and makes job suggestions more useful.",
        keywords: [
          "information",
          "profile",
          "skills",
          "experience",
          "projects",
        ],
        action: { href: "/profile", label: "Complete profile" },
      },
      {
        id: "reset-password",
        category: "account",
        question: "How do I reset my password?",
        answer:
          "Open Forgot password, enter the email connected to your Smart Hire account, and follow the instructions sent to your inbox. If you no longer have access to email or your security method, use the account recovery guide.",
        keywords: ["password", "forgot", "reset", "email", "login"],
        action: { href: "/forgot-password", label: "Reset password" },
      },
      {
        id: "reset-email-missing",
        category: "account",
        question: "What if I do not receive a password reset email?",
        answer:
          "First check spam or junk, confirm the email address is correct, and wait a few minutes before trying again. If the issue continues, create a support request and never include your password or security code in it.",
        keywords: ["email", "missing", "spam", "password", "reset"],
        action: { href: "/support", label: "Create a support request" },
      },
      {
        id: "profile-visibility",
        category: "security",
        question: "Who can see my profile?",
        answer:
          "Profile visibility depends on the permissions and usage context set in Smart Hire. Review your profile before applying and include only information you are comfortable sharing during recruitment.",
        keywords: ["who sees", "profile", "privacy", "permissions", "security"],
        action: {
          href: "/profile/preferences",
          label: "View profile preferences",
        },
      },
      {
        id: "suspicious-activity",
        category: "security",
        question: "What should I do if I notice suspicious activity?",
        answer:
          "Change your password right away and review active sessions in Security. If you need more help, create a support request; support will never ask you for a password or authentication code.",
        keywords: ["suspicious", "security", "account", "sessions", "password"],
        action: { href: "/profile/security", label: "Open security settings" },
      },
    ],
    popularQuestionIds: [
      "smart-match-score",
      "application-response",
      "recruiter-connection",
    ],
    recovery: {
      eyebrow: "ACCOUNT HELP",
      title: "Account recovery",
      subtitle:
        "Start by resetting your password. If you no longer have access to email or your security method, support can guide the next step.",
      stepsHeading: "Try these steps first",
      steps: [
        {
          title: "Use Forgot password",
          description:
            "Enter the email address linked to your Smart Hire account to receive password reset instructions.",
        },
        {
          title: "Check your inbox and junk folder",
          description:
            "The email can take a few minutes to arrive. Check Spam or Junk before requesting another one.",
        },
        {
          title: "Confirm the email address",
          description:
            "Use the same email registered with Smart Hire. The system cannot send instructions to a different address.",
        },
        {
          title: "Contact support if you are still locked out",
          description:
            "Create a support request if you no longer have email access or still need help after trying these steps.",
        },
      ],
      safetyTitle: "Keep your account safe",
      safetyCopy:
        "Never send your password, two-factor authentication code, or backup code in a support message. Smart Hire will not ask for them.",
      resetPassword: "Reset password",
      contactSupport: "Contact support",
      backToSupport: "Back to Support Center",
    },
  };
}
