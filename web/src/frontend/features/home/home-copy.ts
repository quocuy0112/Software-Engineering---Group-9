import type { HomeLocale } from "./home-page-model";

type CuratedCard = { title: string; body: string };

export type HomeCopy = {
  navigation: {
    label: string;
    exploreJobs: string;
    community: string;
    companies: string;
    events: string;
    mobileMenu: string;
    language: string;
    vietnameseCode: string;
    englishCode: string;
  };
  account: {
    login: string;
    signup: string;
    logout: string;
    loggingOut: string;
    logoutSuccess: string;
    logoutError: string;
    profileLabel: string;
    memberFallback: string;
    shortcutsLabel: string;
    dashboard: string;
    applications: string;
    savedJobs: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    keyword: string;
    keywordPlaceholder: string;
    location: string;
    locationPlaceholder: string;
    arrangement: string;
    employmentType: string;
    experienceLevel: string;
    skills: string;
    skillsPlaceholder: string;
    anyArrangement: string;
    anyEmploymentType: string;
    anyExperienceLevel: string;
    search: string;
    invalidSearch: string;
    createProfile: string;
    postJob: string;
    postJobPending: string;
    postJobUnavailable: string;
  };
  filters: Record<string, string>;
  common: {
    displayOnly: string;
    loading: string;
    reloadHome: string;
    viewAllJobs: string;
    viewRole: string;
    accountRequired: string;
  };
  whatsNew: {
    eyebrow: string;
    title: string;
    cards: readonly (CuratedCard & { label: string; type: string })[];
  };
  smartMatch: {
    eyebrow: string;
    title: string;
    personal: string;
    illustrative: string;
    personalScore: string;
    sampleScore: string;
    matchingSkills: string;
    improvementAreas: string;
    limitations: string;
    profileLimitation: string;
    illustrativeLimitation: string;
    estimateLimitation: string;
    decisionNotice: string;
    illustrativeSkills: readonly string[];
    illustrativeAreas: readonly string[];
  };
  careerPaths: {
    eyebrow: string;
    title: string;
    cards: readonly CuratedCard[];
  };
  spotlight: {
    eyebrow: string;
    title: string;
    summaryLabel: string;
    openPositions: string;
    empty: string;
    error: string;
  };
  jobs: {
    eyebrow: string;
    title: string;
    matchEstimate: string;
    save: string;
    saved: string;
    saving: string;
    saveSuccess: string;
    removeSuccess: string;
    saveError: string;
    empty: string;
    error: string;
  };
  growth: {
    eyebrow: string;
    title: string;
    cards: readonly CuratedCard[];
  };
  events: {
    eyebrow: string;
    title: string;
    cards: readonly CuratedCard[];
  };
  finalCta: {
    seekerEyebrow: string;
    seekerTitle: string;
    employerEyebrow: string;
    employerTitle: string;
  };
  footer: { description: string; label: string; jobs: string; companies: string };
};

export const homeCopy = {
  en: {
    navigation: {
      label: "Primary navigation",
      exploreJobs: "Explore Jobs",
      community: "Career Community",
      companies: "Companies",
      events: "Events",
      mobileMenu: "Open navigation menu",
      language: "Home language",
      vietnameseCode: "VI",
      englishCode: "EN",
    },
    account: {
      login: "Log in",
      signup: "Sign up",
      logout: "Log out",
      loggingOut: "Logging out…",
      logoutSuccess: "You have been logged out.",
      logoutError: "Could not log out. Please try again.",
      profileLabel: "Open your profile",
      memberFallback: "Smart Hire member",
      shortcutsLabel: "Personal shortcuts",
      dashboard: "My Dashboard",
      applications: "My Applications",
      savedJobs: "Saved Jobs",
    },
    hero: {
      eyebrow: "SMART HIRE — THE RIGHT OPPORTUNITY, THE RIGHT DIRECTION",
      title: "Find the right job. Meet the right team. Grow in the right direction.",
      description:
        "Discover suitable roles, trustworthy employers, and practical career guidance in Vietnam.",
      keyword: "Keyword",
      keywordPlaceholder: "Role, skill, or company",
      location: "Location",
      locationPlaceholder: "City or province",
      arrangement: "Work arrangement",
      employmentType: "Employment type",
      experienceLevel: "Experience level",
      skills: "Skills",
      skillsPlaceholder: "React, design, data",
      anyArrangement: "Any arrangement",
      anyEmploymentType: "Any employment type",
      anyExperienceLevel: "Any experience level",
      search: "Search jobs",
      invalidSearch: "Review the search filters and try again.",
      createProfile: "Create Profile",
      postJob: "Post a Job",
      postJobPending: "Under review",
      postJobUnavailable: "Status unavailable",
    },
    filters: {
      ONSITE: "On-site",
      HYBRID: "Hybrid",
      REMOTE: "Remote",
      FULL_TIME: "Full-time",
      PART_TIME: "Part-time",
      CONTRACT: "Contract",
      INTERNSHIP: "Internship",
      TEMPORARY: "Temporary",
      ENTRY: "Entry level",
      JUNIOR: "Junior",
      MID: "Mid-level",
      SENIOR: "Senior",
      LEAD: "Lead",
      MANAGER: "Manager",
    },
    common: {
      displayOnly: "Display only",
      loading: "Loading…",
      reloadHome: "Reload Home",
      viewAllJobs: "View all jobs",
      viewRole: "View role",
      accountRequired: "Log in to save this job",
    },
    whatsNew: {
      eyebrow: "COMMUNITY",
      title: "What's New Today?",
      cards: [
        { type: "career", label: "Career post", title: "Turn a class project into a clear portfolio story", body: "Show the problem, your role, the decisions you made, and the outcome." },
        { type: "hiring", label: "Company hiring post", title: "Vietnam product teams are welcoming new graduates", body: "Explore entry-level roles with clear skills, location, and work-arrangement details." },
        { type: "guidance", label: "Career guidance", title: "Prepare useful questions for your first interview", body: "Ask about mentoring, team collaboration, and how success is measured in the first months." },
      ],
    },
    smartMatch: {
      eyebrow: "TRANSPARENT GUIDANCE",
      title: "Smart Match",
      personal: "Personal job-fit recommendation",
      illustrative: "Illustrative Smart Match example",
      personalScore: "Personal match estimate",
      sampleScore: "Illustrative match estimate",
      matchingSkills: "Matching skills",
      improvementAreas: "Improvement areas",
      limitations: "Limitations",
      profileLimitation: "This recommendation uses only the existing structured profile signals available to Smart Hire.",
      illustrativeLimitation: "This example does not use your profile or a live job.",
      estimateLimitation: "The estimate supports job discovery and may not reflect every requirement or team preference.",
      decisionNotice: "This is a recommendation, not applicant screening or a hiring decision.",
      illustrativeSkills: ["TypeScript", "Teamwork", "Problem solving"],
      illustrativeAreas: ["Portfolio evidence", "Project experience"],
    },
    careerPaths: {
      eyebrow: "DIRECTIONS",
      title: "Career Paths",
      cards: [
        { title: "Software Engineering", body: "Build dependable digital products." },
        { title: "UI/UX Design", body: "Design useful and inclusive experiences." },
        { title: "Data & AI", body: "Turn data into responsible decisions." },
        { title: "Digital Marketing", body: "Connect brands with the right audiences." },
        { title: "Business & Sales", body: "Create trusted, sustainable growth." },
        { title: "Product Management", body: "Guide products toward real user needs." },
      ],
    },
    spotlight: {
      eyebrow: "EMPLOYERS",
      title: "Employer Spotlight",
      summaryLabel: "Public company summary",
      openPositions: "open positions",
      empty: "No verified public companies are available yet.",
      error: "Company information is temporarily unavailable.",
    },
    jobs: {
      eyebrow: "DISCOVER",
      title: "Trending Opportunities",
      matchEstimate: "match estimate",
      save: "Save job",
      saved: "Saved",
      saving: "Saving…",
      saveSuccess: "Job saved.",
      removeSuccess: "Job removed from saved jobs.",
      saveError: "Could not update saved jobs. Please try again.",
      empty: "No public opportunities are available yet.",
      error: "Jobs are temporarily unavailable.",
    },
    growth: {
      eyebrow: "GROW",
      title: "Career Growth Hub",
      cards: [
        { title: "Clear CV", body: "Present relevant strengths in one readable page." },
        { title: "Confident interviews", body: "Practice STAR with specific examples." },
        { title: "Story-led portfolio", body: "Explain the problem, role, decisions, and outcome." },
        { title: "Skills roadmap", body: "Choose the next skill for your career direction." },
      ],
    },
    events: {
      eyebrow: "CONNECT",
      title: "Career Events",
      cards: [
        { title: "CV workshop", body: "Illustrative online workshop" },
        { title: "Portfolio review", body: "Illustrative review in Ho Chi Minh City" },
        { title: "Career day", body: "Illustrative university career day in Hanoi" },
        { title: "HR Q&A", body: "Illustrative online question-and-answer session" },
      ],
    },
    finalCta: {
      seekerEyebrow: "YOUR NEXT STEP",
      seekerTitle: "Build a profile that helps the right opportunities find you.",
      employerEyebrow: "FOR EMPLOYERS",
      employerTitle: "Reach candidates through an authorized Smart Hire workspace.",
    },
    footer: {
      description: "An intelligent recruitment platform and professional career community.",
      label: "Footer navigation",
      jobs: "Jobs",
      companies: "Companies",
    },
  },
  vi: {
    navigation: {
      label: "Điều hướng chính",
      exploreJobs: "Khám phá việc làm",
      community: "Cộng đồng nghề nghiệp",
      companies: "Công ty",
      events: "Sự kiện",
      mobileMenu: "Mở menu điều hướng",
      language: "Ngôn ngữ trang chủ",
      vietnameseCode: "VI",
      englishCode: "EN",
    },
    account: {
      login: "Đăng nhập",
      signup: "Đăng ký",
      logout: "Đăng xuất",
      loggingOut: "Đang đăng xuất…",
      logoutSuccess: "Bạn đã đăng xuất.",
      logoutError: "Không thể đăng xuất. Vui lòng thử lại.",
      profileLabel: "Mở hồ sơ của bạn",
      memberFallback: "Thành viên Smart Hire",
      shortcutsLabel: "Lối tắt cá nhân",
      dashboard: "Trang tổng quan",
      applications: "Đơn ứng tuyển của tôi",
      savedJobs: "Việc làm đã lưu",
    },
    hero: {
      eyebrow: "SMART HIRE — ĐÚNG CƠ HỘI, ĐÚNG HƯỚNG ĐI",
      title: "Tìm đúng công việc. Gặp đúng đội ngũ. Phát triển đúng hướng.",
      description: "Khám phá cơ hội phù hợp, doanh nghiệp đáng tin cậy và hướng dẫn nghề nghiệp thiết thực tại Việt Nam.",
      keyword: "Từ khóa",
      keywordPlaceholder: "Vị trí, kỹ năng hoặc công ty",
      location: "Địa điểm",
      locationPlaceholder: "Tỉnh hoặc thành phố",
      arrangement: "Hình thức làm việc",
      employmentType: "Loại việc làm",
      experienceLevel: "Cấp độ kinh nghiệm",
      skills: "Kỹ năng",
      skillsPlaceholder: "React, thiết kế, dữ liệu",
      anyArrangement: "Mọi hình thức",
      anyEmploymentType: "Mọi loại việc làm",
      anyExperienceLevel: "Mọi cấp độ",
      search: "Tìm việc",
      invalidSearch: "Hãy kiểm tra bộ lọc và thử lại.",
      createProfile: "Tạo hồ sơ",
      postJob: "Đăng tin tuyển dụng",
      postJobPending: "Đang xét duyệt",
      postJobUnavailable: "Chưa thể kiểm tra trạng thái",
    },
    filters: {
      ONSITE: "Tại văn phòng",
      HYBRID: "Kết hợp",
      REMOTE: "Từ xa",
      FULL_TIME: "Toàn thời gian",
      PART_TIME: "Bán thời gian",
      CONTRACT: "Hợp đồng",
      INTERNSHIP: "Thực tập",
      TEMPORARY: "Tạm thời",
      ENTRY: "Mới bắt đầu",
      JUNIOR: "Junior",
      MID: "Trung cấp",
      SENIOR: "Cao cấp",
      LEAD: "Trưởng nhóm",
      MANAGER: "Quản lý",
    },
    common: {
      displayOnly: "Chỉ hiển thị",
      loading: "Đang tải…",
      reloadHome: "Tải lại trang chủ",
      viewAllJobs: "Xem tất cả việc làm",
      viewRole: "Xem vị trí",
      accountRequired: "Đăng nhập để lưu việc làm này",
    },
    whatsNew: {
      eyebrow: "CỘNG ĐỒNG",
      title: "Hôm nay có gì mới?",
      cards: [
        { type: "career", label: "Bài viết nghề nghiệp", title: "Biến đồ án thành câu chuyện portfolio rõ ràng", body: "Trình bày vấn đề, vai trò, quyết định của bạn và kết quả đạt được." },
        { type: "hiring", label: "Doanh nghiệp tuyển dụng", title: "Các đội ngũ sản phẩm Việt Nam chào đón sinh viên mới tốt nghiệp", body: "Khám phá vị trí đầu vào với kỹ năng, địa điểm và hình thức làm việc rõ ràng." },
        { type: "guidance", label: "Hướng dẫn nghề nghiệp", title: "Chuẩn bị câu hỏi hữu ích cho buổi phỏng vấn đầu tiên", body: "Hỏi về cố vấn, cách phối hợp trong đội và kỳ vọng trong những tháng đầu." },
      ],
    },
    smartMatch: {
      eyebrow: "GỢI Ý MINH BẠCH",
      title: "Smart Match",
      personal: "Gợi ý việc làm phù hợp với bạn",
      illustrative: "Ví dụ Smart Match minh họa",
      personalScore: "Ước tính phù hợp cá nhân",
      sampleScore: "Ước tính phù hợp minh họa",
      matchingSkills: "Kỹ năng phù hợp",
      improvementAreas: "Điểm có thể cải thiện",
      limitations: "Giới hạn",
      profileLimitation: "Gợi ý chỉ sử dụng các tín hiệu hồ sơ có cấu trúc hiện có trên Smart Hire.",
      illustrativeLimitation: "Ví dụ này không sử dụng hồ sơ của bạn hoặc một việc làm đang tuyển.",
      estimateLimitation: "Ước tính hỗ trợ khám phá việc làm và có thể chưa phản ánh mọi yêu cầu hoặc ưu tiên của đội ngũ.",
      decisionNotice: "Đây là gợi ý, không phải sàng lọc ứng viên hay quyết định tuyển dụng.",
      illustrativeSkills: ["TypeScript", "Làm việc nhóm", "Giải quyết vấn đề"],
      illustrativeAreas: ["Minh chứng portfolio", "Kinh nghiệm dự án"],
    },
    careerPaths: {
      eyebrow: "ĐỊNH HƯỚNG",
      title: "Lộ trình nghề nghiệp",
      cards: [
        { title: "Kỹ thuật phần mềm", body: "Xây dựng sản phẩm số đáng tin cậy." },
        { title: "Thiết kế UI/UX", body: "Thiết kế trải nghiệm hữu ích và hòa nhập." },
        { title: "Dữ liệu & AI", body: "Biến dữ liệu thành quyết định có trách nhiệm." },
        { title: "Digital Marketing", body: "Kết nối thương hiệu với đúng khách hàng." },
        { title: "Kinh doanh & Bán hàng", body: "Tạo tăng trưởng bền vững dựa trên niềm tin." },
        { title: "Quản lý sản phẩm", body: "Dẫn dắt sản phẩm theo nhu cầu thực tế." },
      ],
    },
    spotlight: {
      eyebrow: "NHÀ TUYỂN DỤNG",
      title: "Doanh nghiệp nổi bật",
      summaryLabel: "Giới thiệu công khai của công ty",
      openPositions: "vị trí đang mở",
      empty: "Chưa có doanh nghiệp công khai đã xác minh.",
      error: "Thông tin doanh nghiệp tạm thời chưa khả dụng.",
    },
    jobs: {
      eyebrow: "KHÁM PHÁ",
      title: "Cơ hội đang nổi bật",
      matchEstimate: "ước tính phù hợp",
      save: "Lưu việc làm",
      saved: "Đã lưu",
      saving: "Đang lưu…",
      saveSuccess: "Đã lưu việc làm.",
      removeSuccess: "Đã bỏ lưu việc làm.",
      saveError: "Không thể cập nhật việc đã lưu. Vui lòng thử lại.",
      empty: "Chưa có cơ hội công khai.",
      error: "Việc làm tạm thời chưa khả dụng.",
    },
    growth: {
      eyebrow: "PHÁT TRIỂN",
      title: "Trung tâm phát triển nghề nghiệp",
      cards: [
        { title: "CV rõ ràng", body: "Trình bày điểm mạnh liên quan trong một trang dễ đọc." },
        { title: "Phỏng vấn tự tin", body: "Luyện STAR bằng các ví dụ cụ thể." },
        { title: "Portfolio có câu chuyện", body: "Nêu vấn đề, vai trò, quyết định và kết quả." },
        { title: "Lộ trình kỹ năng", body: "Chọn kỹ năng tiếp theo theo định hướng nghề nghiệp." },
      ],
    },
    events: {
      eyebrow: "KẾT NỐI",
      title: "Sự kiện nghề nghiệp",
      cards: [
        { title: "Workshop CV", body: "Workshop trực tuyến minh họa" },
        { title: "Đánh giá portfolio", body: "Buổi đánh giá minh họa tại TP. Hồ Chí Minh" },
        { title: "Ngày hội việc làm", body: "Ngày hội đại học minh họa tại Hà Nội" },
        { title: "Hỏi đáp cùng HR", body: "Buổi hỏi đáp trực tuyến minh họa" },
      ],
    },
    finalCta: {
      seekerEyebrow: "BƯỚC TIẾP THEO",
      seekerTitle: "Xây dựng hồ sơ giúp cơ hội phù hợp tìm thấy bạn.",
      employerEyebrow: "DÀNH CHO DOANH NGHIỆP",
      employerTitle: "Tiếp cận ứng viên qua không gian Smart Hire được cấp quyền.",
    },
    footer: {
      description: "Nền tảng tuyển dụng thông minh và cộng đồng nghề nghiệp chuyên nghiệp.",
      label: "Điều hướng cuối trang",
      jobs: "Việc làm",
      companies: "Công ty",
    },
  },
} as const satisfies Record<HomeLocale, HomeCopy>;
