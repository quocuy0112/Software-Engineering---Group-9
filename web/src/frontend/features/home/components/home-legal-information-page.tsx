"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  Cookie,
  FileText,
  Globe2,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  MessageSquareText,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  HomeLocaleProvider,
  useHomeLocale,
} from "../client/home-locale-provider";
import { HomeLanguageSelector } from "./home-language-selector";

type LegalPageKind = "privacy" | "terms" | "cookies";
type LegalTone = "brand" | "good" | "violet";
type LegalIconKey =
  | "account"
  | "ai"
  | "check"
  | "compass"
  | "cookie"
  | "file"
  | "globe"
  | "key"
  | "lock"
  | "message"
  | "scale"
  | "shield"
  | "sliders"
  | "user-check";

type LegalDetail = Readonly<{
  icon: LegalIconKey;
  title: string;
  body: string;
}>;
type LegalSection = Readonly<{
  title: string;
  paragraphs: readonly string[];
  details?: readonly LegalDetail[];
  callout?: LegalDetail;
}>;
type LegalDocument = Readonly<{
  eyebrow: string;
  navigationLabel: string;
  title: string;
  description: string;
  effective: string;
  backHome: string;
  support: string;
  supportTitle: string;
  supportDescription: string;
  labels: Record<LegalPageKind, string>;
  highlights: readonly (LegalDetail & { tone: LegalTone })[];
  sections: readonly LegalSection[];
}>;

const legalIcons: Record<LegalIconKey, LucideIcon> = {
  account: UserRound,
  ai: Sparkles,
  check: CheckCircle2,
  compass: Compass,
  cookie: Cookie,
  file: FileText,
  globe: Globe2,
  key: KeyRound,
  lock: LockKeyhole,
  message: MessageSquareText,
  scale: Scale,
  shield: ShieldCheck,
  sliders: SlidersHorizontal,
  "user-check": UserCheck,
};

const pageIcons: Record<LegalPageKind, LucideIcon> = {
  privacy: ShieldCheck,
  terms: FileText,
  cookies: Cookie,
};

const legalRoutes: readonly { kind: LegalPageKind; href: string }[] = [
  { kind: "privacy", href: "/legal/privacy" },
  { kind: "terms", href: "/legal/terms" },
  { kind: "cookies", href: "/legal/cookies" },
];

const englishLabels = {
  privacy: "Privacy",
  terms: "Platform terms",
  cookies: "Cookies & storage",
};

const vietnameseLabels = {
  privacy: "Quyền riêng tư",
  terms: "Điều khoản nền tảng",
  cookies: "Cookie & lưu trữ",
};

const legalCopy: Record<"en" | "vi", Record<LegalPageKind, LegalDocument>> = {
  en: {
    privacy: {
      eyebrow: "PRIVACY INFORMATION",
      navigationLabel: "Legal policy navigation",
      title: "Privacy at SmartHire",
      description:
        "A clear summary of how SmartHire handles account, profile, application, and support information in the product.",
      effective: "Effective",
      backHome: "Back to Home",
      support: "Open Help & support",
      supportTitle: "Need help with a policy or your data?",
      supportDescription:
        "The SmartHire privacy and operations team is ready to help with your request.",
      labels: englishLabels,
      highlights: [
        {
          icon: "shield",
          tone: "brand",
          title: "Protected integrity",
          body: "We do not alter your CV or share it outside the scope of an application.",
        },
        {
          icon: "user-check",
          tone: "good",
          title: "People decide",
          body: "AI supports recommendations; hiring decisions remain with people.",
        },
        {
          icon: "lock",
          tone: "violet",
          title: "Your control",
          body: "Manage your data, profile, and account directly from the workspace.",
        },
      ],
      sections: [
        {
          title: "Information used in the service",
          paragraphs: [
            "SmartHire uses the information you provide to create and secure your account, present your professional profile, support applications, and operate the features you choose.",
          ],
          details: [
            {
              icon: "account",
              title: "Account details",
              body: "Name, email, protected password credentials, and basic contact details.",
            },
            {
              icon: "file",
              title: "Profile and CV",
              body: "Work experience, skills, education, and the documents you attach.",
            },
            {
              icon: "compass",
              title: "Job preferences",
              body: "Desired salary, work location, and job-type preferences.",
            },
            {
              icon: "message",
              title: "Activity and support",
              body: "Application history, conversations, and technical support requests.",
            },
          ],
        },
        {
          title: "How information is shared",
          paragraphs: [
            "Information is shown only in the product context needed for a feature to work, such as sharing an application with the employer for the role you chose.",
          ],
          callout: {
            icon: "ai",
            title: "AI review principle",
            body: "SmartHire does not use AI analysis to make automatic hiring decisions. AI-assisted results are recommendations that remain subject to human review.",
          },
        },
        {
          title: "Your controls",
          paragraphs: [
            "You can review and update your account, professional profile, and preferences from your workspace.",
            "Some information may be retained where it is needed to operate an existing application, maintain security, or meet an applicable operational requirement. Use Help & support if you need help with an account, profile, or data-related request.",
          ],
        },
      ],
    },
    terms: {
      eyebrow: "PLATFORM TERMS",
      navigationLabel: "Legal policy navigation",
      title: "Using SmartHire",
      description:
        "Practical rules for using SmartHire respectfully, securely, and with accurate professional information.",
      effective: "Effective",
      backHome: "Back to Home",
      support: "Open Help & support",
      supportTitle: "Need help with a policy or your data?",
      supportDescription:
        "The SmartHire privacy and operations team is ready to help with your request.",
      labels: englishLabels,
      highlights: [
        {
          icon: "check",
          tone: "brand",
          title: "Accurate and lawful",
          body: "Use accurate professional information and genuine job-posting details.",
        },
        {
          icon: "shield",
          tone: "good",
          title: "No harassment",
          body: "Do not discriminate, harass others, or attempt unauthorised access.",
        },
        {
          icon: "scale",
          tone: "violet",
          title: "Clear responsibility",
          body: "Employers remain responsible for their own hiring decisions.",
        },
      ],
      sections: [
        {
          title: "Use the platform responsibly",
          paragraphs: [
            "Use SmartHire only with accurate information and for legitimate recruitment, career, and professional-community purposes.",
          ],
          callout: {
            icon: "shield",
            title: "Security requirement",
            body: "Do not access another person's account, bypass product controls, submit harmful content, or use the platform to discriminate or harass others.",
          },
        },
        {
          title: "Your account and content",
          paragraphs: [
            "Keep your sign-in credentials and security codes private. You are responsible for the information you submit and should update it when it is no longer accurate.",
            "Employers remain responsible for their job postings, candidate-review process, and decisions. SmartHire supports the workflow but does not make hiring decisions.",
          ],
        },
        {
          title: "Service changes and support",
          paragraphs: [
            "Features may change as the product evolves. When a change materially affects a workflow or policy, SmartHire should communicate it through the product or an appropriate account notice.",
            "For a question about your account or a specific workflow, use Help & support so the request can be handled privately.",
          ],
        },
      ],
    },
    cookies: {
      eyebrow: "COOKIES & STORAGE",
      navigationLabel: "Legal policy navigation",
      title: "Cookies and local storage",
      description:
        "How small browser-stored values help SmartHire keep the service secure and remember your choices.",
      effective: "Effective",
      backHome: "Back to Home",
      support: "Open Help & support",
      supportTitle: "Need help with a policy or your data?",
      supportDescription:
        "The SmartHire privacy and operations team is ready to help with your request.",
      labels: englishLabels,
      highlights: [
        {
          icon: "key",
          tone: "brand",
          title: "Secure sessions",
          body: "Supports signed-in sessions and account-security checks.",
        },
        {
          icon: "globe",
          tone: "good",
          title: "Remember language",
          body: "Keeps your Home language setting consistent on later visits.",
        },
        {
          icon: "sliders",
          tone: "violet",
          title: "Flexible control",
          body: "You can clear browser-stored data from your browser settings.",
        },
      ],
      sections: [
        {
          title: "Essential service storage",
          paragraphs: [
            "SmartHire uses essential browser storage for functions such as maintaining a signed-in session, protecting requests, and keeping the service working reliably.",
          ],
          callout: {
            icon: "shield",
            title: "Why this is needed",
            body: "These values are necessary for account security and core platform operation.",
          },
        },
        {
          title: "Preference storage",
          paragraphs: [
            "The public Home experience can store a language preference in your browser so the selected language remains consistent on later visits.",
            "You can clear browser storage in your browser settings. Clearing it can sign you out or reset saved preferences.",
          ],
        },
        {
          title: "Changes to this page",
          paragraphs: [
            "If optional analytics, advertising, or other non-essential storage is introduced, SmartHire should update this page and provide the appropriate choice before that storage is used.",
            "Contact Help & support if you have a question about browser storage or your account security.",
          ],
        },
      ],
    },
  },
  vi: {
    privacy: {
      eyebrow: "THÔNG TIN QUYỀN RIÊNG TƯ",
      navigationLabel: "Điều hướng chính sách pháp lý",
      title: "Quyền riêng tư tại SmartHire",
      description:
        "Bản tóm tắt rõ ràng về cách SmartHire xử lý thông tin tài khoản, hồ sơ, đơn ứng tuyển và yêu cầu hỗ trợ trong sản phẩm.",
      effective: "Hiệu lực",
      backHome: "Quay lại trang chủ",
      support: "Mở Trợ giúp & hỗ trợ",
      supportTitle: "Bạn cần hỗ trợ thêm về chính sách hoặc dữ liệu?",
      supportDescription:
        "Đội ngũ bảo vệ quyền riêng tư và vận hành SmartHire luôn sẵn sàng giải đáp yêu cầu của bạn.",
      labels: vietnameseLabels,
      highlights: [
        {
          icon: "shield",
          tone: "brand",
          title: "Bảo mật nguyên vẹn",
          body: "Không tự ý sửa đổi CV hoặc chia sẻ ngoài phạm vi vị trí ứng tuyển.",
        },
        {
          icon: "user-check",
          tone: "good",
          title: "Con người quyết định",
          body: "AI chỉ hỗ trợ gợi ý; quyết định tuyển dụng do con người thực hiện.",
        },
        {
          icon: "lock",
          tone: "violet",
          title: "Quyền kiểm soát cao",
          body: "Chủ động quản lý dữ liệu, hồ sơ và tài khoản từ Workspace.",
        },
      ],
      sections: [
        {
          title: "Thông tin được sử dụng trong dịch vụ",
          paragraphs: [
            "SmartHire sử dụng thông tin bạn cung cấp để tạo và bảo vệ tài khoản, hiển thị hồ sơ nghề nghiệp, hỗ trợ ứng tuyển và vận hành những tính năng bạn chọn sử dụng.",
          ],
          details: [
            {
              icon: "account",
              title: "Dữ liệu tài khoản",
              body: "Họ tên, email, mật khẩu bảo mật và thông tin liên lạc cơ bản.",
            },
            {
              icon: "file",
              title: "Hồ sơ và CV",
              body: "Kinh nghiệm làm việc, kỹ năng chuyên môn, học vấn và tài liệu đính kèm.",
            },
            {
              icon: "compass",
              title: "Ưu tiên tìm việc",
              body: "Mức lương mong muốn, khu vực làm việc và loại hình công việc.",
            },
            {
              icon: "message",
              title: "Hoạt động & hỗ trợ",
              body: "Lịch sử nộp đơn, tin nhắn trao đổi và các yêu cầu trợ giúp kỹ thuật.",
            },
          ],
        },
        {
          title: "Cách thông tin được chia sẻ",
          paragraphs: [
            "Thông tin chỉ được hiển thị trong ngữ cảnh cần thiết để một tính năng hoạt động, chẳng hạn chia sẻ đơn ứng tuyển với doanh nghiệp cho vị trí bạn đã chọn ứng tuyển.",
          ],
          callout: {
            icon: "ai",
            title: "Nguyên tắc đánh giá AI",
            body: "SmartHire không dùng phân tích AI để tự động đưa ra quyết định tuyển dụng. Kết quả có hỗ trợ AI là gợi ý và vẫn cần được con người xem xét.",
          },
        },
        {
          title: "Quyền kiểm soát của bạn",
          paragraphs: [
            "Bạn có thể xem và cập nhật tài khoản, hồ sơ nghề nghiệp và các tùy chọn từ Workspace.",
            "Một số thông tin có thể được lưu khi cần để vận hành đơn đang tồn tại, duy trì bảo mật hoặc đáp ứng yêu cầu vận hành phù hợp. Hãy dùng Trợ giúp & hỗ trợ nếu bạn cần trợ giúp về tài khoản, hồ sơ hoặc yêu cầu liên quan đến dữ liệu.",
          ],
        },
      ],
    },
    terms: {
      eyebrow: "ĐIỀU KHOẢN NỀN TẢNG",
      navigationLabel: "Điều hướng chính sách pháp lý",
      title: "Sử dụng SmartHire",
      description:
        "Các nguyên tắc thực tế để sử dụng SmartHire tôn trọng, an toàn và với thông tin nghề nghiệp chính xác.",
      effective: "Hiệu lực",
      backHome: "Quay lại trang chủ",
      support: "Mở Trợ giúp & hỗ trợ",
      supportTitle: "Bạn cần hỗ trợ thêm về chính sách hoặc dữ liệu?",
      supportDescription:
        "Đội ngũ bảo vệ quyền riêng tư và vận hành SmartHire luôn sẵn sàng giải đáp yêu cầu của bạn.",
      labels: vietnameseLabels,
      highlights: [
        {
          icon: "check",
          tone: "brand",
          title: "Chính xác & hợp pháp",
          body: "Cung cấp thông tin nghề nghiệp và tin tuyển dụng đúng thực tế.",
        },
        {
          icon: "shield",
          tone: "good",
          title: "Không quấy rối",
          body: "Không phân biệt đối xử, quấy rối hoặc xâm nhập trái phép.",
        },
        {
          icon: "scale",
          tone: "violet",
          title: "Minh bạch vai trò",
          body: "Doanh nghiệp tự chịu trách nhiệm về quyết định tuyển dụng.",
        },
      ],
      sections: [
        {
          title: "Sử dụng nền tảng có trách nhiệm",
          paragraphs: [
            "Chỉ sử dụng SmartHire với thông tin chính xác và cho mục đích tuyển dụng, phát triển nghề nghiệp hoặc cộng đồng chuyên môn hợp pháp.",
          ],
          callout: {
            icon: "shield",
            title: "Yêu cầu bảo mật",
            body: "Không cố truy cập tài khoản của người khác, vượt qua các cơ chế kiểm soát, gửi nội dung gây hại hoặc dùng nền tảng để phân biệt đối xử hay quấy rối.",
          },
        },
        {
          title: "Tài khoản và nội dung của bạn",
          paragraphs: [
            "Giữ kín thông tin đăng nhập và mã bảo mật. Bạn chịu trách nhiệm về thông tin đã gửi và nên cập nhật khi thông tin không còn chính xác.",
            "Doanh nghiệp chịu trách nhiệm về tin tuyển dụng, quy trình xem xét ứng viên và quyết định của mình. SmartHire hỗ trợ quy trình nhưng không đưa ra quyết định tuyển dụng.",
          ],
        },
        {
          title: "Thay đổi dịch vụ và hỗ trợ",
          paragraphs: [
            "Tính năng có thể thay đổi khi sản phẩm phát triển. Khi một thay đổi ảnh hưởng đáng kể đến quy trình hoặc chính sách, SmartHire nên thông báo qua sản phẩm hoặc thông báo tài khoản phù hợp.",
            "Với câu hỏi về tài khoản hay quy trình cụ thể, hãy dùng Trợ giúp & hỗ trợ để yêu cầu được xử lý riêng tư.",
          ],
        },
      ],
    },
    cookies: {
      eyebrow: "COOKIE & LƯU TRỮ",
      navigationLabel: "Điều hướng chính sách pháp lý",
      title: "Cookie và lưu trữ cục bộ",
      description:
        "Cách các giá trị nhỏ được lưu trên trình duyệt giúp SmartHire giữ dịch vụ an toàn và ghi nhớ lựa chọn của bạn.",
      effective: "Hiệu lực",
      backHome: "Quay lại trang chủ",
      support: "Mở Trợ giúp & hỗ trợ",
      supportTitle: "Bạn cần hỗ trợ thêm về chính sách hoặc dữ liệu?",
      supportDescription:
        "Đội ngũ bảo vệ quyền riêng tư và vận hành SmartHire luôn sẵn sàng giải đáp yêu cầu của bạn.",
      labels: vietnameseLabels,
      highlights: [
        {
          icon: "key",
          tone: "brand",
          title: "Phiên làm việc an toàn",
          body: "Duy trì phiên đăng nhập và các kiểm tra bảo mật tài khoản.",
        },
        {
          icon: "globe",
          tone: "good",
          title: "Ghi nhớ ngôn ngữ",
          body: "Giữ nhất quán ngôn ngữ Home cho những lần truy cập sau.",
        },
        {
          icon: "sliders",
          tone: "violet",
          title: "Tùy chỉnh linh hoạt",
          body: "Bạn có thể xóa dữ liệu duyệt web trong phần cài đặt trình duyệt.",
        },
      ],
      sections: [
        {
          title: "Lưu trữ cần thiết cho dịch vụ",
          paragraphs: [
            "SmartHire dùng lưu trữ thiết yếu trên trình duyệt cho các chức năng như duy trì phiên đăng nhập, bảo vệ yêu cầu và vận hành dịch vụ ổn định.",
          ],
          callout: {
            icon: "shield",
            title: "Vì sao cần thiết",
            body: "Các giá trị này cần thiết cho bảo mật tài khoản và hoạt động cốt lõi của nền tảng.",
          },
        },
        {
          title: "Lưu trữ tùy chọn",
          paragraphs: [
            "Trải nghiệm Home công khai có thể lưu lựa chọn ngôn ngữ trong trình duyệt để giữ nhất quán ở các lần truy cập sau.",
            "Bạn có thể xóa dữ liệu lưu trữ trong phần cài đặt trình duyệt. Việc xóa có thể đăng xuất hoặc đặt lại các tùy chọn đã lưu.",
          ],
        },
        {
          title: "Thay đổi đối với trang này",
          paragraphs: [
            "Nếu SmartHire bổ sung analytics, quảng cáo hoặc lưu trữ không thiết yếu khác, trang này cần được cập nhật và phải có lựa chọn phù hợp trước khi sử dụng loại lưu trữ đó.",
            "Hãy liên hệ Trợ giúp & hỗ trợ nếu bạn có câu hỏi về lưu trữ trình duyệt hoặc bảo mật tài khoản.",
          ],
        },
      ],
    },
  },
};

function LegalCallout({ callout }: { callout: LegalDetail }) {
  const Icon = legalIcons[callout.icon];
  return (
    <aside className="home-legal-callout">
      <Icon aria-hidden="true" />
      <div>
        <h3>{callout.title}</h3>
        <p>{callout.body}</p>
      </div>
    </aside>
  );
}

function LegalContent({ kind }: { kind: LegalPageKind }) {
  const { locale } = useHomeLocale();
  const copy = legalCopy[locale][kind];

  return (
    <main className="home-legal-page">
      <div className="home-legal-shell">
        <nav className="home-legal-utility" aria-label={copy.backHome}>
          <Link className="home-legal-back" href="/">
            <ArrowLeft aria-hidden="true" />
            <span>{copy.backHome}</span>
          </Link>
          <div className="home-legal-utility-actions">
            <HomeLanguageSelector />
            <span className="home-legal-effective">
              <CalendarDays aria-hidden="true" />
              {copy.effective}: <strong>2026-08-24</strong>
            </span>
          </div>
        </nav>

        <nav className="home-legal-tabs" aria-label={copy.navigationLabel}>
          {legalRoutes.map((route) => {
            const Icon = pageIcons[route.kind];
            const active = route.kind === kind;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : undefined}
                href={route.href}
                key={route.kind}
              >
                <Icon aria-hidden="true" />
                <span>{copy.labels[route.kind]}</span>
              </Link>
            );
          })}
        </nav>

        <article className="home-legal-hero">
          <div className="home-legal-eyebrow">
            <span aria-hidden="true" />
            {copy.eyebrow}
          </div>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>

          <div className="home-legal-highlights">
            {copy.highlights.map((highlight) => {
              const Icon = legalIcons[highlight.icon];
              return (
                <section
                  className={`home-legal-highlight home-legal-highlight--${highlight.tone}`}
                  key={highlight.title}
                >
                  <Icon aria-hidden="true" />
                  <div>
                    <h2>{highlight.title}</h2>
                    <p>{highlight.body}</p>
                  </div>
                </section>
              );
            })}
          </div>
        </article>

        <div className="home-legal-sections">
          {copy.sections.map((section, index) => (
            <section className="home-legal-section" key={section.title}>
              <div className="home-legal-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="home-legal-section-content">
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.details ? (
                  <div className="home-legal-details">
                    {section.details.map((detail) => {
                      const Icon = legalIcons[detail.icon];
                      return (
                        <section key={detail.title}>
                          <Icon aria-hidden="true" />
                          <div>
                            <h3>{detail.title}</h3>
                            <p>{detail.body}</p>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : null}
                {section.callout ? <LegalCallout callout={section.callout} /> : null}
              </div>
            </section>
          ))}
        </div>

        <section className="home-legal-support">
          <div>
            <h2>
              <LifeBuoy aria-hidden="true" />
              {copy.supportTitle}
            </h2>
            <p>{copy.supportDescription}</p>
          </div>
          <Link href="/help">
            <span>{copy.support}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}

export function HomeLegalInformationPage({ kind }: { kind: LegalPageKind }) {
  return (
    <HomeLocaleProvider initialLocale="vi">
      <LegalContent kind={kind} />
    </HomeLocaleProvider>
  );
}
