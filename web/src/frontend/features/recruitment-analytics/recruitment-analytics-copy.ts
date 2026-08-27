import type { WorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";

export type AnalyticsStage =
  | "APPLIED"
  | "VIEWED"
  | "SHORTLISTED"
  | "INTERVIEWING"
  | "OFFERED"
  | "HIRED"
  | "OFFER_DECLINED"
  | "REJECTED"
  | "WAITLISTED";

export type RecruitmentAnalyticsCopy = {
  locale: "vi-VN" | "en-US";
  notAvailable: string;
  untitledJob: string;
  overview: {
    eyebrow: string;
    title: string;
    intro: string;
    manageJobs: string;
    contextMetrics: (timeZone: string) => string;
    contextCollectionStarted: (date: string) => string;
    reportsReady: (ready: number, total: number) => string;
    loading: string;
    updating: string;
    updated: (date: string) => string;
    autoRefresh: string;
    metricsTitle: string;
    metrics: {
      activeJobs: string;
      activeJobsDescription: string;
      qualifiedViews: string;
      qualifiedViewsDescription: string;
      applications: string;
      applicationsDescription: string;
      withdrawn: string;
      withdrawnDescription: string;
      conversion: string;
      conversionUnavailable: string;
      conversionFormula: string;
    };
    unavailable: (count: number) => string;
    jobUnavailable: string;
    retry: string;
    performanceEyebrow: string;
    performanceTitle: string;
    performanceDescription: string;
    refresh: string;
    emptyTitle: string;
    emptyDescription: string;
    createJob: string;
    tableCaption: string;
    columns: {
      job: string;
      views: string;
      applications: string;
      conversion: string;
      withdrawn: string;
      export: string;
      sortBy: (label: string) => string;
    };
    active: string;
    closed: string;
    selectedLoading: (title: string) => string;
    selectedLoadingDescription: string;
  };
  filters: {
    reportingWindow: string;
    datePresets: string;
    days: (count: number) => string;
    from: string;
    startDate: string;
    toInclusive: string;
    endDate: string;
    groupBy: string;
    day: string;
    week: string;
    month: string;
    updating: string;
    apply: string;
    invalidRange: string;
  };
  report: {
    selectedPosting: string;
    description: string;
    posting: string;
    selectPosting: string;
    snapshotCutoff: string;
    definition: (version: string) => string;
    qualifiedViews: string;
    qualifiedViewsDescription: string;
    applications: string;
    applicationsDescription: string;
    withdrawn: string;
    withdrawnDescription: string;
    conversion: string;
    conversionUnavailable: string;
    conversionFormula: string;
    funnelCandidates: string;
    funnelCandidatesDescription: string;
    definitionsSummary: string;
    qualifiedViewsDefinition: string;
    conversionDefinition: string;
    funnelDefinition: string;
    historicalDefinition: (date: string) => string;
  };
  funnel: {
    stageLabels: Record<AnalyticsStage, string>;
    eyebrow: string;
    title: string;
    description: (jobTitle: string) => string;
    asOf: (date: string) => string;
    stagesLabel: string;
    pipelinePercentage: (percentage: string) => string;
    withdrawn: (count: string) => string;
    withdrawnDescription: string;
    noActiveApplications: string;
    noApplications: string;
    tableSummary: string;
    tableCaption: (jobTitle: string) => string;
    stage: string;
    candidates: string;
    share: string;
  };
  export: {
    status: Record<
      "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "EXPIRED",
      string
    >;
    startError: string;
    responseError: string;
    downloadError: string;
    downloadStarted: string;
    networkExportError: string;
    networkDownloadError: string;
    fileReady: string;
    preparingMessage: string;
    format: string;
    formatFor: (jobTitle: string) => string;
    export: string;
    preparing: string;
    download: string;
    panelFor: (jobTitle: string) => string;
    rows: (count: string) => string;
  };
};

export function recruitmentAnalyticsCopy(
  locale: WorkspaceLocale,
): RecruitmentAnalyticsCopy {
  if (locale === "vi") {
    return {
      locale: "vi-VN",
      notAvailable: "Chưa có dữ liệu",
      untitledJob: "Tin tuyển dụng chưa có tiêu đề",
      overview: {
        eyebrow: "Không gian nhà tuyển dụng",
        title: "Tổng quan tuyển dụng",
        intro:
          "Theo dõi tin tuyển dụng thu hút sự chú ý, tiến độ ứng viên và việc cần ưu tiên xem xét tiếp theo.",
        manageJobs: "Quản lý tin tuyển dụng",
        contextMetrics: (timeZone) =>
          `Số liệu dùng lượt xem đủ điều kiện và đơn ứng tuyển đã gửi trong khoảng thời gian đã chọn. Ngày kết thúc bao gồm toàn bộ ngày theo múi giờ ${timeZone}. Đơn đã rút được hiển thị riêng và không tính vào ảnh chụp quy trình hiện tại.`,
        contextCollectionStarted: (date) =>
          `Khoảng thời gian đã chọn bắt đầu trước khi hệ thống thu thập số liệu; dữ liệu được hiển thị từ ${date}.`,
        reportsReady: (ready, total) => `${ready}/${total} báo cáo đã sẵn sàng`,
        loading: "Đang tải số liệu tuyển dụng…",
        updating: "Đang cập nhật số liệu tuyển dụng…",
        updated: (date) => `Đã cập nhật ${date}`,
        autoRefresh: "Tự động cập nhật mỗi 15 giây",
        metricsTitle: "Số liệu tổng quan",
        metrics: {
          activeJobs: "Tin tuyển dụng đang hoạt động",
          activeJobsDescription: "Hiện đang hiển thị cho ứng viên",
          qualifiedViews: "Lượt xem đủ điều kiện",
          qualifiedViewsDescription: "Trên các tin đang hoạt động và đã đóng",
          applications: "Đơn ứng tuyển",
          applicationsDescription: "Đã gửi trong khoảng thời gian đã chọn",
          withdrawn: "Đơn đã rút",
          withdrawnDescription: "Không tính vào ảnh chụp quy trình hiện tại",
          conversion: "Tỷ lệ chuyển đổi tổng thể",
          conversionUnavailable:
            "Chưa có lượt xem đủ điều kiện trong khoảng đã chọn",
          conversionFormula: "Đơn ứng tuyển chia cho lượt xem đủ điều kiện",
        },
        unavailable: (count) =>
          `Không thể tải số liệu cho ${count} tin tuyển dụng. Các dòng có dữ liệu vẫn được hiển thị.`,
        jobUnavailable: "Không thể tải số liệu của tin tuyển dụng này.",
        retry: "Thử lại",
        performanceEyebrow: "Hiệu quả tin tuyển dụng",
        performanceTitle: "Tin tuyển dụng",
        performanceDescription:
          "Sắp xếp theo lượng tiếp cận hoặc tỷ lệ chuyển đổi, sau đó chọn một tin để xem quy trình.",
        refresh: "Làm mới",
        emptyTitle: "Chưa có tin tuyển dụng để phân tích",
        emptyDescription:
          "Hãy đăng một tin tuyển dụng để bắt đầu thu thập lượt xem đủ điều kiện và đơn ứng tuyển.",
        createJob: "Tạo tin tuyển dụng",
        tableCaption:
          "Lượt xem, đơn ứng tuyển, đơn đã rút, tỷ lệ chuyển đổi và thao tác xuất dữ liệu tin tuyển dụng",
        columns: {
          job: "Tin tuyển dụng",
          views: "Lượt xem",
          applications: "Đơn ứng tuyển",
          conversion: "Chuyển đổi",
          withdrawn: "Đã rút",
          export: "Xuất ứng viên",
          sortBy: (label) => `Sắp xếp theo ${label}`,
        },
        active: "Đang hoạt động",
        closed: "Đã đóng",
        selectedLoading: (title) => `Đang tải số liệu cho ${title}…`,
        selectedLoadingDescription:
          "Đang lấy khoảng thời gian báo cáo đã chọn.",
      },
      filters: {
        reportingWindow: "Khoảng thời gian báo cáo",
        datePresets: "Khoảng thời gian nhanh",
        days: (count) => `${count} ngày`,
        from: "Từ",
        startDate: "Ngày bắt đầu",
        toInclusive: "Đến (bao gồm)",
        endDate: "Ngày kết thúc",
        groupBy: "Nhóm theo",
        day: "Ngày",
        week: "Tuần",
        month: "Tháng",
        updating: "Đang cập nhật…",
        apply: "Áp dụng",
        invalidRange: "Hãy chọn ngày bắt đầu trước ngày kết thúc.",
      },
      report: {
        selectedPosting: "Tin đã chọn",
        description:
          "So sánh mức độ tiếp cận và sức khỏe quy trình của một tin trong khoảng thời gian báo cáo đã chọn.",
        posting: "Tin tuyển dụng",
        selectPosting: "Chọn tin tuyển dụng để xem quy trình",
        snapshotCutoff: "Mốc chốt dữ liệu",
        definition: (version) => `Định nghĩa ${version}`,
        qualifiedViews: "Lượt xem đủ điều kiện",
        qualifiedViewsDescription:
          "Lượt xem được loại trùng theo khách truy cập, tin tuyển dụng và ngày",
        applications: "Đơn ứng tuyển",
        applicationsDescription: "Đơn ứng tuyển đã gửi trong khoảng thời gian",
        withdrawn: "Đã rút",
        withdrawnDescription: "Không tính vào ảnh chụp quy trình hiện tại",
        conversion: "Từ lượt xem đến đơn ứng tuyển",
        conversionUnavailable:
          "Chưa có lượt xem đủ điều kiện trong khoảng đã chọn",
        conversionFormula: "Đơn ứng tuyển chia cho lượt xem đủ điều kiện",
        funnelCandidates: "Ứng viên trong quy trình",
        funnelCandidatesDescription: "Ảnh chụp các vòng chuẩn hóa hiện tại",
        definitionsSummary: "Định nghĩa số liệu và ghi chú dữ liệu",
        qualifiedViewsDefinition:
          "Lượt xem đủ điều kiện loại trừ bản xem trước của chủ sở hữu, lưu lượng tự động và lượt truy cập trùng từ cùng một khách trong cùng một ngày trên nền tảng.",
        conversionDefinition:
          "Tỷ lệ chuyển đổi hiển thị là Chưa có dữ liệu cho đến khi khoảng thời gian đã chọn có ít nhất một lượt xem đủ điều kiện. Để tạo lượt xem, hãy mở tin công khai với tư cách ứng viên hoặc khách ẩn danh; bản xem trước của nhà tuyển dụng, bot và lượt xem lặp trong ngày đều bị loại trừ.",
        funnelDefinition:
          "Quy trình là ảnh chụp hiện tại tại mốc chốt dữ liệu. Mỗi đơn ứng tuyển chỉ xuất hiện ở một vòng chuẩn hóa nên số lượng giữa các vòng không chồng lấn.",
        historicalDefinition: (date) => `Dữ liệu lịch sử có từ ${date}.`,
      },
      funnel: {
        stageLabels: {
          APPLIED: "Mới ứng tuyển",
          VIEWED: "Đã xem",
          SHORTLISTED: "Danh sách rút gọn",
          INTERVIEWING: "Đang phỏng vấn",
          OFFERED: "Đã gửi đề nghị",
          HIRED: "Đã tuyển",
          OFFER_DECLINED: "Từ chối đề nghị",
          REJECTED: "Đã từ chối",
          WAITLISTED: "Danh sách chờ",
        },
        eyebrow: "Ảnh chụp quy trình",
        title: "Quy trình tuyển dụng",
        description: (jobTitle) =>
          `Phân bổ ứng viên hiện tại cho ${jobTitle}. Tỷ lệ được tính trên toàn bộ quy trình tại mốc chốt dữ liệu.`,
        asOf: (date) => `Tính đến ${date}`,
        stagesLabel: "Các vòng trong quy trình tuyển dụng",
        pipelinePercentage: (percentage) => `${percentage}% quy trình`,
        withdrawn: (count) => `Đơn đã rút: ${count}`,
        withdrawnDescription: "Không tính vào tỷ lệ của các vòng hiện tại.",
        noActiveApplications:
          "Không còn đơn ứng tuyển đang hoạt động trong quy trình.",
        noApplications: "Chưa có đơn ứng tuyển cho tin này.",
        tableSummary: "Xem quy trình dưới dạng bảng",
        tableCaption: (jobTitle) =>
          `Dữ liệu quy trình tuyển dụng cho ${jobTitle}`,
        stage: "Vòng",
        candidates: "Ứng viên",
        share: "Tỷ trọng quy trình",
      },
      export: {
        status: {
          QUEUED: "Đang xếp hàng",
          PROCESSING: "Đang chuẩn bị tệp",
          SUCCEEDED: "Sẵn sàng tải xuống",
          FAILED: "Xuất dữ liệu thất bại",
          EXPIRED: "Tệp xuất đã hết hạn",
        },
        startError: "Không thể bắt đầu xuất dữ liệu.",
        responseError: "Phản hồi xuất dữ liệu không hợp lệ.",
        downloadError: "Không thể tải tệp xuống.",
        downloadStarted: "Đã bắt đầu tải xuống.",
        networkExportError: "Lỗi mạng. Hãy thử xuất dữ liệu lại.",
        networkDownloadError: "Lỗi mạng. Hãy thử tải tệp lại.",
        fileReady: "Tệp của bạn đã sẵn sàng.",
        preparingMessage: "Tệp xuất của bạn đang được chuẩn bị.",
        format: "Định dạng xuất",
        formatFor: (jobTitle) => `Định dạng xuất cho ${jobTitle}`,
        export: "Xuất dữ liệu",
        preparing: "Đang chuẩn bị…",
        download: "Tải xuống",
        panelFor: (jobTitle) => `Xuất ứng viên cho ${jobTitle}`,
        rows: (count) => `${count} dòng`,
      },
    };
  }

  return {
    locale: "en-US",
    notAvailable: "N/A",
    untitledJob: "Untitled job posting",
    overview: {
      eyebrow: "Recruiter workspace",
      title: "Hiring overview",
      intro:
        "See which postings attract attention, where candidates progress, and what deserves your next review.",
      manageJobs: "Manage job postings",
      contextMetrics: (timeZone) =>
        `Metrics use qualified views and submitted applications in the selected window. The end date includes the full local calendar day in ${timeZone}. Withdrawn applications are shown separately and excluded from the current funnel snapshot.`,
      contextCollectionStarted: (date) =>
        `The selected window begins before analytics collection started; data is shown from ${date}.`,
      reportsReady: (ready, total) => `${ready}/${total} reports ready`,
      loading: "Loading analytics…",
      updating: "Updating analytics…",
      updated: (date) => `Updated ${date}`,
      autoRefresh: "Auto-refreshes every 15 seconds",
      metricsTitle: "Overview metrics",
      metrics: {
        activeJobs: "Active job postings",
        activeJobsDescription: "Currently visible to candidates",
        qualifiedViews: "Qualified views",
        qualifiedViewsDescription: "Across active and closed postings",
        applications: "Applications",
        applicationsDescription: "Submitted in the selected window",
        withdrawn: "Withdrawn applications",
        withdrawnDescription: "Excluded from the current funnel snapshot",
        conversion: "Overall conversion",
        conversionUnavailable: "No qualified views in the selected window",
        conversionFormula: "Applications divided by qualified views",
      },
      unavailable: (count) =>
        `Analytics are unavailable for ${count} posting${count === 1 ? "" : "s"}. Available rows are still shown below.`,
      jobUnavailable: "This posting's analytics are unavailable.",
      retry: "Retry",
      performanceEyebrow: "Posting performance",
      performanceTitle: "Job postings",
      performanceDescription:
        "Sort by acquisition volume or conversion, then select a posting to inspect its funnel.",
      refresh: "Refresh",
      emptyTitle: "No active job postings to analyze",
      emptyDescription:
        "Publish a job posting to start collecting qualified views and applications.",
      createJob: "Create a job posting",
      tableCaption:
        "Job posting views, applications, withdrawn applications, conversion, and export actions",
      columns: {
        job: "Job posting",
        views: "Views",
        applications: "Applications",
        conversion: "Conversion",
        withdrawn: "Withdrawn",
        export: "Export candidates",
        sortBy: (label) => `Sort by ${label}`,
      },
      active: "Active",
      closed: "Closed",
      selectedLoading: (title) => `Loading ${title} analytics…`,
      selectedLoadingDescription: "Fetching the selected reporting window.",
    },
    filters: {
      reportingWindow: "Reporting window",
      datePresets: "Date presets",
      days: (count) => `${count} days`,
      from: "From",
      startDate: "Start date",
      toInclusive: "To (inclusive)",
      endDate: "End date",
      groupBy: "Group by",
      day: "Day",
      week: "Week",
      month: "Month",
      updating: "Updating…",
      apply: "Apply",
      invalidRange: "Choose a start date before the end date.",
    },
    report: {
      selectedPosting: "Selected posting",
      description:
        "Compare acquisition and pipeline health for one posting within the selected reporting window.",
      posting: "Posting",
      selectPosting: "Select job posting for funnel",
      snapshotCutoff: "Snapshot cutoff",
      definition: (version) => `Definition ${version}`,
      qualifiedViews: "Qualified views",
      qualifiedViewsDescription: "Deduplicated visitor-posting-day views",
      applications: "Applications",
      applicationsDescription: "Submitted applications in the window",
      withdrawn: "Withdrawn",
      withdrawnDescription: "Excluded from the current funnel snapshot",
      conversion: "View-to-application",
      conversionUnavailable: "No qualified views in the selected window",
      conversionFormula: "Applications divided by qualified views",
      funnelCandidates: "Funnel candidates",
      funnelCandidatesDescription: "Current canonical stage snapshot",
      definitionsSummary: "Metric definitions and data notes",
      qualifiedViewsDefinition:
        "Qualified views exclude owner previews, automated traffic, and duplicate visits from the same visitor on the same platform day.",
      conversionDefinition:
        "Conversion is shown as N/A until the selected window contains at least one qualified view. To collect one, open the public posting as a candidate or anonymous visitor; recruiter previews, bots, and same-day repeat visits are excluded.",
      funnelDefinition:
        "The funnel is a current snapshot at the cutoff. Each application appears in one canonical stage, so stage counts are mutually exclusive.",
      historicalDefinition: (date) =>
        `Historical reporting is available from ${date}.`,
    },
    funnel: {
      stageLabels: {
        APPLIED: "Applied",
        VIEWED: "Viewed",
        SHORTLISTED: "Shortlisted",
        INTERVIEWING: "Interviewing",
        OFFERED: "Offered",
        HIRED: "Hired",
        OFFER_DECLINED: "Offer declined",
        REJECTED: "Rejected",
        WAITLISTED: "Waitlisted",
      },
      eyebrow: "Pipeline snapshot",
      title: "Hiring funnel",
      description: (jobTitle) =>
        `Current candidate distribution for ${jobTitle}. Percentages are based on the full funnel at the report cutoff.`,
      asOf: (date) => `As of ${date}`,
      stagesLabel: "Hiring funnel stages",
      pipelinePercentage: (percentage) => `${percentage}% of pipeline`,
      withdrawn: (count) => `Withdrawn applications: ${count}`,
      withdrawnDescription: "Excluded from current funnel-stage percentages.",
      noActiveApplications: "No active applications remain in the funnel.",
      noApplications: "No applications yet for this job posting.",
      tableSummary: "View funnel as a table",
      tableCaption: (jobTitle) => `Hiring funnel data for ${jobTitle}`,
      stage: "Stage",
      candidates: "Candidates",
      share: "Share of pipeline",
    },
    export: {
      status: {
        QUEUED: "Queued",
        PROCESSING: "Preparing file",
        SUCCEEDED: "Ready to download",
        FAILED: "Export failed",
        EXPIRED: "Export expired",
      },
      startError: "The export could not be started.",
      responseError: "The export response was invalid.",
      downloadError: "The download is unavailable.",
      downloadStarted: "Download started.",
      networkExportError: "Network error. Try exporting again.",
      networkDownloadError: "Network error. Try downloading again.",
      fileReady: "Your file is ready.",
      preparingMessage: "Your export is being prepared.",
      format: "Export format",
      formatFor: (jobTitle) => `Export format for ${jobTitle}`,
      export: "Export",
      preparing: "Preparing…",
      download: "Download",
      panelFor: (jobTitle) => `Export candidates for ${jobTitle}`,
      rows: (count) => `${count} rows`,
    },
  };
}
