"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  businessFactsDiffer,
  businessTaxIdentifierSchema,
  preparationPatchSchema,
} from "@/shared/contracts/employer-verification/business-verification";
import {
  registryLookupConfirmsBusiness,
  type EmployerVerificationPreparationResponse,
} from "@/shared/contracts/employer-verification/business-verification-responses";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
import { WorkspacePageHeader } from "@/frontend/features/dashboard/components/page-header";
import { useNotificationContextRead } from "@/frontend/features/notifications/client/use-notification-context-read";
import styles from "./employer-verification-page.module.css";

type Item = {
  id: string;
  submittedCompanyName: string;
  normalizedTaxIdentifier: string;
  requestedRole: string;
  state: string;
  resubmissionCount: number;
  createdAt: string;
};

type Preparation = EmployerVerificationPreparationResponse["data"];

export function employerVerificationCopy(locale: "vi" | "en") {
  return locale === "vi"
    ? {
        eyebrow: "Xác thực nhà tuyển dụng",
        title: "Xây dựng danh tính doanh nghiệp đáng tin cậy",
        subtitle:
          "Xác nhận thông tin đăng ký, hộp thư công ty, mối quan hệ với doanh nghiệp, và 1 giấy phép được bảo vệ.",
        stepper: {
          ariaLabel: "Tiến trình xác thực",
          step1: "Doanh nghiệp đăng ký",
          step2: "Hộp thư công ty",
          step3: "Bằng chứng thẩm quyền",
        },
        step1: {
          title: "Doanh nghiệp đăng ký",
          hint: "Bắt đầu với đúng mã số thuế doanh nghiệp gồm 10 chữ số.",
          fieldLabel: "Mã số thuế Việt Nam",
          fieldNote:
            "10 ký tự số. Mã đã xác nhận sẽ bị khoá cho tới khi bạn khởi động lại quá trình xác thực.",
          submit: "Tra cứu doanh nghiệp",
          lookingUp: "Đang tra cứu…",
          changeTaxId: "Đổi mã số thuế",
          resetting: "Đang đặt lại…",
          recordFound: "Đã tìm thấy bản ghi doanh nghiệp",
          notFound: "Không tìm thấy mã số thuế",
          unavailable: "Tạm thời không thể xác nhận từ cổng đăng ký",
          sourcePrefix: "Nguồn:",
          checkedPrefix: "kiểm tra",
          legalName: "Tên pháp lý",
          registeredAddress: "Địa chỉ đăng ký",
          established: "Ngày thành lập",
          notSupplied: "Không có từ nguồn tra cứu",
          completePrompt:
            "Hoàn tất xác nhận đăng ký trước khi tiếp tục nhập chi tiết công ty.",
        },
        step2: {
          title: "Thông tin doanh nghiệp",
          hint: "Kiểm tra các giá trị đã xác nhận từ cổng đăng ký và cung cấp các thông tin chuẩn hoá còn lại.",
          legalName: "Tên pháp lý công ty",
          registeredAddress: "Địa chỉ đăng ký",
          operatingDiffers: "Địa điểm hoạt động khác với địa chỉ đăng ký",
          operatingAddress: "Địa chỉ hoạt động",
          mismatchLabel: "Giải thích chênh lệch so với cổng đăng ký (nếu có)",
          mismatchHelp:
            "Bắt buộc khi tên pháp lý hoặc địa chỉ đăng ký khác với dữ liệu nguồn. Điền từ 20–500 ký tự.",
        },
        step3: {
          title: "Liên hệ công ty",
          hint: "Xác minh quyền kiểm soát hộp thư; số điện thoại sẽ ở trạng thái chưa xác minh.",
          emailStatus: "Trạng thái email",
          verified: "Đã xác minh:",
          pending: "Đang chờ:",
          notVerified: "Chưa xác minh",
          companyEmail: "Email công ty",
          sendLink: "Gửi liên kết xác minh",
          queuing: "Đang gửi…",
          companyPhone: "Số điện thoại công ty",
          phoneHelp:
            "Lưu theo định dạng +84. Không thực hiện OTP; số điện thoại này chưa được xác minh.",
          website: "Website công ty (không bắt buộc)",
          websiteHelp:
            "Chỉ chấp nhận domain công khai giao thức HTTPS; không chứa đường dẫn, query, fragment, localhost hoặc địa chỉ IP.",
        },
        step4: {
          title: "Bằng chứng thẩm quyền của bạn",
          hint: "Giải thích mối quan hệ của bạn và đồng ý xử lý tài liệu an toàn.",
          relationship: "Mối quan hệ với công ty",
          selectRelationship: "Chọn mối quan hệ",
          relationships: {
            LEGAL_OWNER: "Chủ sở hữu pháp lý",
            AUTHORIZED_EMPLOYEE: "Nhân viên được uỷ quyền",
            INVITED_MEMBER: "Thành viên được mời",
            EXISTING_OWNER_APPROVAL: "Được chủ sở hữu hiện tại chấp thuận",
            OTHER: "Khác",
          },
          currentJobTitle: "Chức danh hiện tại",
          authorityExplanation: "Giải thích thẩm quyền",
          authorityHelp:
            "Bắt buộc đối với Nhân viên được uỷ quyền và Khác; điền từ 20–500 ký tự.",
          businessLicense: "Giấy phép kinh doanh",
          licenseHelp: "PDF, PNG, hoặc JPEG · 1 byte đến 5.000.000 bytes.",
          accuracyDeclaration:
            "Tôi cam đoan rằng các thông tin doanh nghiệp và thẩm quyền này là chính xác.",
          documentConsent:
            "Tôi đồng ý kiểm tra an toàn và cho phép con người xét duyệt tài liệu doanh nghiệp này.",
          submitButton: "Gửi yêu cầu làm nhà tuyển dụng",
          submitting: "Đang gửi…",
          verifyEmailFirst: "Xác minh email công ty để gửi yêu cầu",
        },
        trust: {
          badgeTitle: "Được con người xét duyệt",
          badgeDesc:
            "Dữ liệu đăng ký chỉ hỗ trợ xét duyệt, không tự động cấp quyền truy cập.",
          label: "Tín hiệu xét duyệt",
          title: "Quản trị viên sẽ thấy gì",
          signal1: {
            title: "Ảnh chụp dữ liệu đăng ký",
            desc: "Nguồn tra cứu, thời điểm kiểm tra, và chênh lệch từng trường thông tin.",
          },
          signal2: {
            title: "Kiểm soát liên hệ",
            desc: "Hộp thư đã xác minh, cùng tín hiệu số điện thoại và tên miền website chưa xác minh.",
          },
          signal3: {
            title: "Bằng chứng thẩm quyền",
            desc: "Mối quan hệ của bạn, giải thích, sự đồng ý, và giấy phép được bảo vệ.",
          },
          humanOnlyTitle: "Chỉ con người mới quyết định",
          humanOnlyDesc:
            "Không có tín hiệu tra cứu, email, số điện thoại hay website nào có thể tự động duyệt hoặc từ chối yêu cầu này.",
        },
        history: {
          label: "Lịch sử yêu cầu",
          title: "Yêu cầu làm nhà tuyển dụng của bạn",
          empty:
            "Chưa có yêu cầu xác thực nào. Các yêu cầu bạn gửi sẽ xuất hiện ở đây.",
          requestsCount: "yêu cầu",
          submitted: "Đã nộp",
          taxId: "Mã số thuế",
          requestedRole: "Vai trò yêu cầu",
          resubmissions: "Số lần nộp lại",
          of: "trên",
          cancelRequest: "Huỷ yêu cầu",
          replacementLicense: "Giấy phép kinh doanh thay thế",
          resubmitEvidence: "Nộp lại bằng chứng",
        },
        statuses: {
          PENDING_CHECKS: "Đang kiểm tra an toàn",
          PENDING_REVIEW: "Đang xét duyệt",
          CHANGES_REQUESTED: "Yêu cầu bổ sung",
          APPROVED: "Đã duyệt",
          REJECTED: "Không được duyệt",
          CANCELLED: "Đã huỷ",
        },
      }
    : {
        eyebrow: "Employer verification",
        title: "Build a trusted company identity",
        subtitle:
          "Confirm registered facts, a reachable company mailbox, your relationship to the business, and one protected license document.",
        stepper: {
          ariaLabel: "Verification progress",
          step1: "Registered business",
          step2: "Company mailbox",
          step3: "Authority evidence",
        },
        step1: {
          title: "Registered business",
          hint: "Start with the exact 10-digit enterprise tax identifier.",
          fieldLabel: "Vietnamese tax identifier",
          fieldNote:
            "Ten ASCII digits. A confirmed identifier is locked until you restart verification.",
          submit: "Look up business",
          lookingUp: "Looking up…",
          changeTaxId: "Change tax identifier",
          resetting: "Resetting…",
          recordFound: "Registered business record found",
          notFound: "Tax identifier not found",
          unavailable: "Registry confirmation unavailable",
          sourcePrefix: "Source:",
          checkedPrefix: "checked",
          legalName: "Legal name",
          registeredAddress: "Registered address",
          established: "Established",
          notSupplied: "Not supplied by source",
          completePrompt:
            "Complete registry confirmation before continuing to company details.",
        },
        step2: {
          title: "Business information",
          hint: "Review the confirmed registry values and provide the remaining normalized facts.",
          legalName: "Legal company name",
          registeredAddress: "Registered address",
          operatingDiffers:
            "Operating location differs from registered address",
          operatingAddress: "Operating address",
          mismatchLabel: "Explain differences from registry (if any)",
          mismatchHelp:
            "Required when legal name or registered address differs from source facts. Use 20–500 characters when provided.",
        },
        step3: {
          title: "Company contact",
          hint: "Verify mailbox control; phone remains clearly unverified.",
          emailStatus: "Email status",
          verified: "Verified:",
          pending: "Pending:",
          notVerified: "Not verified",
          companyEmail: "Company email",
          sendLink: "Send verification link",
          queuing: "Queuing…",
          companyPhone: "Company phone",
          phoneHelp:
            "Stored in +84 format. No OTP is performed; this phone is unverified.",
          website: "Company website (optional)",
          websiteHelp:
            "Public HTTPS origin only; paths, queries, fragments, localhost, and IP addresses are rejected.",
        },
        step4: {
          title: "Your authority and evidence",
          hint: "Explain your relationship and consent to protected document processing.",
          relationship: "Relationship to company",
          selectRelationship: "Select relationship",
          relationships: {
            LEGAL_OWNER: "Legal owner",
            AUTHORIZED_EMPLOYEE: "Authorized employee",
            INVITED_MEMBER: "Invited member",
            EXISTING_OWNER_APPROVAL: "Existing owner approval",
            OTHER: "Other",
          },
          currentJobTitle: "Current job title",
          authorityExplanation: "Authority explanation",
          authorityHelp:
            "Required for authorized employees and Other; use 20–500 characters.",
          businessLicense: "Business license",
          licenseHelp: "PDF, PNG, or JPEG · 1 byte to 5,000,000 bytes.",
          accuracyDeclaration:
            "I declare that these business and authority details are accurate.",
          documentConsent:
            "I consent to safety checking and human review of this business document.",
          submitButton: "Submit recruiter application",
          submitting: "Submitting…",
          verifyEmailFirst: "Verify company email to submit",
        },
        trust: {
          badgeTitle: "Human-reviewed",
          badgeDesc:
            "Registry data supports review; it never auto-approves access.",
          label: "Review signals",
          title: "What the administrator sees",
          signal1: {
            title: "Registry snapshot",
            desc: "Source, checked time, and exact field differences.",
          },
          signal2: {
            title: "Contact control",
            desc: "Verified mailbox plus unverified phone and website-domain signals.",
          },
          signal3: {
            title: "Authority evidence",
            desc: "Your relationship, explanation, consent, and protected license.",
          },
          humanOnlyTitle: "Human decision only",
          humanOnlyDesc:
            "No lookup, email, phone, or website signal can approve or reject this request automatically.",
        },
        history: {
          label: "Application history",
          title: "Your recruiter applications",
          empty:
            "No verification requests. Your submitted applications will appear here.",
          requestsCount: "requests",
          submitted: "Submitted",
          taxId: "Tax identifier",
          requestedRole: "Requested role",
          resubmissions: "Resubmissions",
          of: "of",
          cancelRequest: "Cancel request",
          replacementLicense: "Replacement business license",
          resubmitEvidence: "Resubmit evidence",
        },
        statuses: {
          PENDING_CHECKS: "Safety checks",
          PENDING_REVIEW: "Under review",
          CHANGES_REQUESTED: "Changes requested",
          APPROVED: "Approved",
          REJECTED: "Not approved",
          CANCELLED: "Cancelled",
        },
      };
}

const statusPresentation: Record<
  string,
  { labelEn: string; labelVi: string; tone: string }
> = {
  PENDING_CHECKS: {
    labelEn: "Safety checks",
    labelVi: "Đang kiểm tra an toàn",
    tone: "info",
  },
  PENDING_REVIEW: {
    labelEn: "Under review",
    labelVi: "Đang xét duyệt",
    tone: "warning",
  },
  CHANGES_REQUESTED: {
    labelEn: "Changes requested",
    labelVi: "Yêu cầu bổ sung",
    tone: "warning",
  },
  APPROVED: {
    labelEn: "Approved",
    labelVi: "Đã duyệt",
    tone: "success",
  },
  REJECTED: {
    labelEn: "Not approved",
    labelVi: "Không được duyệt",
    tone: "danger",
  },
  CANCELLED: {
    labelEn: "Cancelled",
    labelVi: "Đã huỷ",
    tone: "neutral",
  },
};

function presentStatus(state: string, locale: "vi" | "en") {
  const meta = statusPresentation[state];
  if (meta) {
    return {
      label: locale === "vi" ? meta.labelVi : meta.labelEn,
      tone: meta.tone,
    };
  }
  return {
    label: state.replaceAll("_", " ").toLowerCase(),
    tone: "neutral",
  };
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({ code: "REQUEST_FAILED" }));
  if (!response.ok) {
    throw Object.assign(new Error(body.code ?? "REQUEST_FAILED"), {
      body,
      status: response.status,
    });
  }
  return body;
}

function lookupFailureMessage(error: unknown) {
  const failure = error as {
    body?: { code?: unknown; retryAfterSeconds?: unknown };
  };
  const code = typeof failure.body?.code === "string" ? failure.body.code : "";
  if (code === "RATE_LIMITED") {
    const retryAfter =
      typeof failure.body?.retryAfterSeconds === "number"
        ? Math.max(1, Math.ceil(failure.body.retryAfterSeconds / 60))
        : null;
    return retryAfter
      ? `Too many registry lookups. Try again in about ${retryAfter} minute${retryAfter === 1 ? "" : "s"}.`
      : "Too many registry lookups. Try again later.";
  }
  if (code === "UNAUTHORIZED") {
    return "Your session has expired. Sign in again and retry the lookup.";
  }
  if (code === "VALIDATION_FAILED") {
    return "Enter a valid 10-digit tax identifier and try again.";
  }
  return "The business registry is temporarily unavailable. Try again later.";
}

function draftFieldError(name: string) {
  const messages: Record<string, string> = {
    applicantLegalName:
      "Legal company name is required and must be at most 240 characters.",
    applicantRegisteredAddress:
      "Registered address must contain 5–500 characters.",
    operatingAddress: "Operating address must contain 5–500 characters.",
    companyPhone: "Enter a valid Vietnamese phone number such as 0901 234 567.",
    website:
      "Enter a public company domain using HTTPS, without a path, query, or fragment.",
    relationship: "Select a valid relationship to the company.",
    currentJobTitle: "Current job title must contain 2–120 characters.",
    authorityExplanation:
      "Authority explanation must contain 20–500 characters.",
    mismatchExplanation:
      "Difference explanation must contain 20–500 characters when provided.",
  };
  return messages[name] ?? "This field is invalid. Review it and try again.";
}

function submissionFailureMessage(error: unknown) {
  const failure = error as {
    body?: {
      code?: unknown;
      fieldErrors?: Array<{ field?: unknown; message?: unknown }>;
    };
  };
  const code = typeof failure.body?.code === "string" ? failure.body.code : "";
  const fieldError = failure.body?.fieldErrors?.find(
    (item) => typeof item.message === "string" && item.message.length > 0,
  );
  if (code === "VALIDATION_FAILED" && fieldError) {
    const field =
      typeof fieldError.field === "string" ? fieldError.field : "form";
    return `${field}: ${fieldError.message}`;
  }
  const messages: Record<string, string> = {
    LOOKUP_REQUIRED:
      "The business lookup expired or changed. Look up the tax identifier again before submitting.",
    EMAIL_VERIFICATION_REQUIRED:
      "Verify the company email again before submitting the recruiter application.",
    MISMATCH_EXPLANATION_REQUIRED:
      "Explain the differences between your entries and the registry before submitting.",
    RELATIONSHIP_REQUIRED:
      "An active company invitation or owner approval is required for this recruiter application.",
    DUPLICATE_AUTHORITY: "You already have active authority for this company.",
    ACTIVE_REQUEST_EXISTS:
      "An active recruiter application already exists for this tax identifier.",
    STALE_CONFLICT:
      "The verification draft changed while you were editing it. Reload the page and try again.",
    FILE_SIZE_INVALID: "Choose a PDF, PNG, or JPEG file no larger than 5 MB.",
    FILE_TYPE_INVALID: "Choose a PDF, PNG, or JPEG business license file.",
    TARGET_UNAVAILABLE:
      "The selected company relationship is no longer available. Refresh and try again.",
    UNAUTHORIZED: "Your session has expired. Sign in again and retry.",
  };
  return (
    messages[code] ??
    (code
      ? `The recruiter application could not be submitted (${code}).`
      : "The recruiter application could not be submitted. Try again.")
  );
}

function VerificationContextRead({
  requestId,
  csrfProof,
}: {
  requestId: string;
  csrfProof: string;
}) {
  useNotificationContextRead({
    enabled: true,
    contextType: "VERIFICATION_REQUEST",
    contextId: requestId,
    csrfProof,
  });
  return null;
}

export function EmployerVerificationPage({
  csrfProof = "",
}: {
  csrfProof?: string;
}) {
  const locale = useWorkspaceLocale();
  const copy = employerVerificationCopy(locale);

  const [items, setItems] = useState<Item[]>([]);
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean | null>>(
    {},
  );
  const [companyEmail, setCompanyEmail] = useState("");
  const [taxIdentifier, setTaxIdentifier] = useState("");
  const [busy, setBusy] = useState<string>();
  const preparationRef = useRef<Preparation | null>(null);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const resubmitInFlightRef = useRef(new Set<string>());

  async function loadRequests() {
    const body = (await requestJson("/api/employer-verifications")) as {
      data: Item[];
    };
    setItems(body.data);
    return body.data;
  }

  async function loadPreparation() {
    const body = (await requestJson(
      "/api/employer-verifications/preparation",
    )) as EmployerVerificationPreparationResponse;
    preparationRef.current = body.data;
    setPreparation(body.data);
    setDraft(body.data.draft);
    setTaxIdentifier(body.data.lookup?.taxIdentifier ?? "");
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      requestJson("/api/employer-verifications"),
      requestJson("/api/employer-verifications/preparation"),
    ])
      .then(([requests, current]) => {
        if (!active) return;
        preparationRef.current = current.data;
        setItems(requests.data);
        setPreparation(current.data);
        setDraft(current.data.draft);
        setTaxIdentifier(current.data.lookup?.taxIdentifier ?? "");
      })
      .catch(() => toast.error("Employer verification could not be loaded."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "company-email-token",
    );
    if (!token) return;
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    void requestJson("/api/employer-verifications/company-email/confirm", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(async () => {
        toast.success("Company email verified.", { id: "company-email" });
        await loadPreparation();
      })
      .catch(() =>
        toast.error("This verification link is invalid or expired.", {
          id: "company-email",
        }),
      )
      .finally(() => undefined);
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTaxIdentifier =
      businessTaxIdentifierSchema.safeParse(taxIdentifier);
    if (!normalizedTaxIdentifier.success) {
      toast.error("Enter a valid 10-digit tax identifier and try again.", {
        id: "business-lookup",
      });
      return;
    }
    setBusy("lookup");
    try {
      const body = (await requestJson(
        "/api/employer-verifications/registry-lookups",
        {
          method: "POST",
          body: JSON.stringify({ taxIdentifier: normalizedTaxIdentifier.data }),
        },
      )) as EmployerVerificationPreparationResponse;
      preparationRef.current = body.data;
      setPreparation(body.data);
      setDraft(body.data.draft);
      setCompanyEmail("");
      setTaxIdentifier(
        body.data.lookup?.taxIdentifier ?? normalizedTaxIdentifier.data,
      );
      if (
        body.data.lookup &&
        registryLookupConfirmsBusiness(body.data.lookup.outcome)
      ) {
        toast.success("Registered business record found.", {
          id: "business-lookup",
        });
      } else {
        const lookupOutcome = body.data.lookup?.outcome;
        toast.error(
          lookupOutcome === "NOT_FOUND"
            ? "This tax identifier was not found in the business registry."
            : lookupOutcome === "UNAVAILABLE"
              ? "The business registry is currently unavailable. Try again later."
              : "The registry could not confirm this tax identifier. Try again later.",
          { id: "business-lookup" },
        );
      }
    } catch (error) {
      toast.error(lookupFailureMessage(error), { id: "business-lookup" });
    } finally {
      setBusy(undefined);
    }
  }

  async function resetTaxIdentifier() {
    setBusy("reset-lookup");
    try {
      const body = (await requestJson(
        "/api/employer-verifications/preparation",
        {
          method: "DELETE",
        },
      )) as EmployerVerificationPreparationResponse;
      preparationRef.current = body.data;
      setPreparation(body.data);
      setDraft(body.data.draft);
      setCompanyEmail("");
      setTaxIdentifier("");
      toast.success("Tax identifier cleared. Start the verification again.", {
        id: "business-lookup",
      });
    } catch {
      toast.error("The tax identifier could not be changed. Try again.", {
        id: "business-lookup",
      });
    } finally {
      setBusy(undefined);
    }
  }

  function saveDraft(name: string, value: string | boolean | null) {
    setDraft((current) => ({ ...current, [name]: value }));
    const run = async () => {
      const current = preparationRef.current;
      if (!current?.preparationId) return;
      const payload = preparationPatchSchema.safeParse({
        preparationId: current.preparationId,
        version: current.version,
        changes: { [name]: value },
      });
      if (!payload.success) {
        toast.error(draftFieldError(name), {
          id: `verification-draft-${name}`,
        });
        return;
      }
      try {
        const body = (await requestJson(
          "/api/employer-verifications/preparation",
          {
            method: "PATCH",
            body: JSON.stringify(payload.data),
          },
        )) as EmployerVerificationPreparationResponse;
        preparationRef.current = body.data;
        setPreparation(body.data);
        setDraft(body.data.draft);
      } catch (error) {
        const failure = error as Error & { status?: number };
        if (failure.status === 409) {
          await loadPreparation();
          toast.error(
            "The draft changed in another request. Latest values were restored.",
            {
              id: "verification-draft-conflict",
            },
          );
          return;
        }
        toast.error(draftFieldError(name), {
          id: `verification-draft-${name}`,
        });
      }
    };
    draftSaveQueueRef.current = draftSaveQueueRef.current.then(run, run);
    return draftSaveQueueRef.current;
  }

  async function issueEmail() {
    if (!preparation) return;
    setBusy("email");
    try {
      await requestJson(
        "/api/employer-verifications/company-email/challenges",
        {
          method: "POST",
          body: JSON.stringify({
            preparationVersion: preparation.version,
            email: companyEmail,
          }),
        },
      );
      toast.success("Verification email queued. Check the company inbox.", {
        id: "company-email",
      });
      await loadPreparation();
    } catch {
      toast.error("Use a valid company email and try again later.", {
        id: "company-email",
      });
    } finally {
      setBusy(undefined);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.querySelector<HTMLElement>(":invalid")?.focus();
      toast.error("Correct the highlighted fields before submitting.");
      return;
    }
    setBusy("submit");
    try {
      await draftSaveQueueRef.current;
      const latestPreparation = preparationRef.current;
      if (!latestPreparation?.preparationId || !latestPreparation.lookup) {
        throw Object.assign(new Error("LOOKUP_REQUIRED"), {
          body: { code: "LOOKUP_REQUIRED" },
        });
      }
      const payload = new FormData(form);
      payload.set("preparationId", latestPreparation.preparationId);
      payload.set("preparationVersion", String(latestPreparation.version));
      payload.set("lookupSnapshotId", latestPreparation.lookup.snapshotId);
      payload.set("taxIdentifier", latestPreparation.lookup.taxIdentifier);
      await requestJson("/api/employer-verifications", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: payload,
      });
      toast.success("Verification request received.");
      form.reset();
      preparationRef.current = null;
      setPreparation(null);
      setDraft({});
      await Promise.all([loadRequests(), loadPreparation()]);
    } catch (error) {
      toast.error(submissionFailureMessage(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function cancel(requestId: string) {
    setBusy(requestId);
    try {
      await requestJson(
        `/api/employer-verifications/${encodeURIComponent(requestId)}/cancel`,
        { method: "POST" },
      );
      toast.success("Verification request cancelled.");
      await loadRequests();
    } catch {
      toast.error("Cancellation failed.");
    } finally {
      setBusy(undefined);
    }
  }

  async function resubmit(
    requestId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (resubmitInFlightRef.current.has(requestId)) return;
    resubmitInFlightRef.current.add(requestId);
    const form = event.currentTarget;
    setBusy(requestId);
    try {
      await requestJson(
        `/api/employer-verifications/${encodeURIComponent(requestId)}/resubmit`,
        { method: "POST", body: new FormData(form) },
      );
      form.reset();
      toast.success("Replacement evidence received.");
      await loadRequests();
    } catch (error) {
      const code = (
        error as Error & { body?: { code?: string }; status?: number }
      ).body?.code;
      if (code === "TARGET_UNAVAILABLE") {
        const refreshed = await loadRequests().catch(() => undefined);
        const current = refreshed?.find((item) => item.id === requestId);
        if (
          current &&
          ["PENDING_CHECKS", "PENDING_REVIEW", "RESUBMITTED"].includes(
            current.state,
          )
        ) {
          form.reset();
          toast.success(
            "Replacement evidence was already received and is under review.",
          );
          return;
        }
      }
      toast.error("Replacement evidence could not be accepted.");
    } finally {
      resubmitInFlightRef.current.delete(requestId);
      setBusy(undefined);
    }
  }

  const lookupFacts = preparation?.lookup?.facts;
  const mismatchExplanationRequired = Boolean(
    lookupFacts &&
    (businessFactsDiffer(
      String(draft.applicantLegalName ?? ""),
      lookupFacts.legalName,
    ) ||
      businessFactsDiffer(
        String(draft.applicantRegisteredAddress ?? ""),
        lookupFacts.registeredAddress,
      )),
  );
  const registryConfirmed = Boolean(
    preparation?.lookup &&
    taxIdentifier === preparation.lookup.taxIdentifier &&
    registryLookupConfirmsBusiness(preparation.lookup.outcome),
  );
  const emailVerified = preparation?.email.status === "VERIFIED";
  const relationship = String(draft.relationship ?? "");
  const authorityExplanationRequired = [
    "AUTHORIZED_EMPLOYEE",
    "OTHER",
  ].includes(relationship);

  type StepState = "todo" | "current" | "done";
  const step1State: StepState = registryConfirmed ? "done" : "current";
  const step2State: StepState = !registryConfirmed
    ? "todo"
    : emailVerified
      ? "done"
      : "current";
  const step3State: StepState = !(registryConfirmed && emailVerified)
    ? "todo"
    : "current";

  return (
    <main className={styles.page}>
      <WorkspacePageHeader
        className={styles.phead}
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.subtitle}
      />

      <nav aria-label={copy.stepper.ariaLabel} className={styles.stepper}>
        <div
          className={`${styles.sstep} ${
            step1State === "current"
              ? styles.current
              : step1State === "done"
                ? styles.done
                : styles.todo
          }`}
        >
          <div className={styles.snum}>{step1State === "done" ? "✓" : "1"}</div>
          <div className={styles.slabel}>{copy.stepper.step1}</div>
        </div>
        <div className={styles.sline} aria-hidden="true" />
        <div
          className={`${styles.sstep} ${
            step2State === "current"
              ? styles.current
              : step2State === "done"
                ? styles.done
                : styles.todo
          }`}
        >
          <div className={styles.snum}>{step2State === "done" ? "✓" : "2"}</div>
          <div className={styles.slabel}>{copy.stepper.step2}</div>
        </div>
        <div className={styles.sline} aria-hidden="true" />
        <div
          className={`${styles.sstep} ${step3State === "current" ? styles.current : styles.todo}`}
        >
          <div className={styles.snum}>3</div>
          <div className={styles.slabel}>{copy.stepper.step3}</div>
        </div>
      </nav>

      <div className={styles.applicationGrid}>
        <div className={styles.formStack}>
          <section className={`${styles.card} ${styles.formCard}`}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}>1</span>
              <h2>{copy.step1.title}</h2>
            </div>
            <p className={styles.sectionHint}>{copy.step1.hint}</p>
            <form className={styles.lookupForm} onSubmit={lookup}>
              <div className={styles.lookupField}>
                <label htmlFor="taxIdentifier">{copy.step1.fieldLabel}</label>
                <div className={styles.lookupRow}>
                  <input
                    id="taxIdentifier"
                    name="taxIdentifier"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    placeholder="0123456789"
                    required
                    value={taxIdentifier}
                    readOnly={registryConfirmed}
                    onChange={(event) => setTaxIdentifier(event.target.value)}
                    aria-describedby="tax-help"
                  />
                  {registryConfirmed ? (
                    <button
                      className={styles.secondaryButton}
                      disabled={busy === "reset-lookup"}
                      type="button"
                      onClick={() => void resetTaxIdentifier()}
                    >
                      {busy === "reset-lookup"
                        ? copy.step1.resetting
                        : copy.step1.changeTaxId}
                    </button>
                  ) : (
                    <button
                      className={styles.primaryButton}
                      disabled={busy === "lookup"}
                      type="submit"
                    >
                      {busy === "lookup"
                        ? copy.step1.lookingUp
                        : copy.step1.submit}
                    </button>
                  )}
                </div>
                <small id="tax-help">{copy.step1.fieldNote}</small>
              </div>
            </form>
            {preparation?.lookup && (
              <div
                className={styles.registryPanel}
                data-outcome={preparation.lookup.outcome}
              >
                <strong>
                  {registryConfirmed
                    ? copy.step1.recordFound
                    : preparation.lookup.outcome === "NOT_FOUND"
                      ? copy.step1.notFound
                      : copy.step1.unavailable}
                </strong>
                <span>
                  {copy.step1.sourcePrefix} {preparation.lookup.sourceLabel} ·{" "}
                  {copy.step1.checkedPrefix}{" "}
                  {new Date(preparation.lookup.checkedAt).toLocaleString(
                    locale === "vi" ? "vi-VN" : "en-US",
                  )}
                </span>
                <dl>
                  <div>
                    <dt>{copy.step1.legalName}</dt>
                    <dd>{lookupFacts?.legalName ?? copy.step1.notSupplied}</dd>
                  </div>
                  <div>
                    <dt>{copy.step1.registeredAddress}</dt>
                    <dd>
                      {lookupFacts?.registeredAddress ?? copy.step1.notSupplied}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.step1.established}</dt>
                    <dd>
                      {lookupFacts?.establishmentDate ?? copy.step1.notSupplied}
                    </dd>
                  </div>
                </dl>
                {!registryConfirmed && <p>{copy.step1.completePrompt}</p>}
              </div>
            )}
          </section>

          {registryConfirmed && preparation?.lookup && (
            <form className={styles.formStack} onSubmit={submit} noValidate>
              <input
                type="hidden"
                name="preparationId"
                value={preparation.preparationId ?? ""}
              />
              <input
                type="hidden"
                name="preparationVersion"
                value={preparation.version}
              />
              <input
                type="hidden"
                name="lookupSnapshotId"
                value={preparation.lookup.snapshotId}
              />
              <input
                type="hidden"
                name="taxIdentifier"
                value={preparation.lookup.taxIdentifier}
              />
              <input type="hidden" name="requestedRole" value="RECRUITER" />
              <input
                type="hidden"
                name="policyVersion"
                value="business-verification-consent-v1"
              />

              <section className={`${styles.card} ${styles.formCard}`}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>2</span>
                  <h2>{copy.step2.title}</h2>
                </div>
                <p className={styles.sectionHint}>{copy.step2.hint}</p>
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span>{copy.step2.legalName}</span>
                    <input
                      name="applicantLegalName"
                      required
                      minLength={1}
                      maxLength={240}
                      value={String(draft.applicantLegalName ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, applicantLegalName: val }));
                      }}
                      onBlur={(e) =>
                        void saveDraft("applicantLegalName", e.target.value)
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>{copy.step2.registeredAddress}</span>
                    <textarea
                      name="applicantRegisteredAddress"
                      required
                      minLength={5}
                      maxLength={500}
                      value={String(draft.applicantRegisteredAddress ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({
                          ...c,
                          applicantRegisteredAddress: val,
                        }));
                      }}
                      onBlur={(e) =>
                        void saveDraft(
                          "applicantRegisteredAddress",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      name="operatingAddressDiffers"
                      type="checkbox"
                      value="true"
                      checked={Boolean(draft.operatingAddressDiffers)}
                      onChange={(e) =>
                        void saveDraft(
                          "operatingAddressDiffers",
                          e.target.checked,
                        )
                      }
                    />
                    <span>{copy.step2.operatingDiffers}</span>
                  </label>
                  {Boolean(draft.operatingAddressDiffers) && (
                    <label className={styles.field}>
                      <span>{copy.step2.operatingAddress}</span>
                      <textarea
                        name="operatingAddress"
                        required
                        minLength={5}
                        maxLength={500}
                        value={String(draft.operatingAddress ?? "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((c) => ({ ...c, operatingAddress: val }));
                        }}
                        onBlur={(e) =>
                          void saveDraft("operatingAddress", e.target.value)
                        }
                      />
                    </label>
                  )}
                  <label className={styles.field}>
                    <span>{copy.step2.mismatchLabel}</span>
                    <textarea
                      name="mismatchExplanation"
                      minLength={20}
                      maxLength={500}
                      required={mismatchExplanationRequired}
                      value={String(draft.mismatchExplanation ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, mismatchExplanation: val }));
                      }}
                      onBlur={(e) =>
                        void saveDraft(
                          "mismatchExplanation",
                          e.target.value || null,
                        )
                      }
                    />
                    <small>{copy.step2.mismatchHelp}</small>
                  </label>
                </div>
              </section>

              <section className={`${styles.card} ${styles.formCard}`}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>3</span>
                  <h2>{copy.step3.title}</h2>
                </div>
                <p className={styles.sectionHint}>{copy.step3.hint}</p>
                <div className={styles.form}>
                  <div className={styles.verifiedRow}>
                    <span>{copy.step3.emailStatus}</span>
                    <strong data-verified={emailVerified}>
                      {emailVerified
                        ? `${copy.step3.verified} ${preparation.email.maskedEmail}`
                        : preparation.email.status === "PENDING"
                          ? `${copy.step3.pending} ${preparation.email.maskedEmail}`
                          : copy.step3.notVerified}
                    </strong>
                  </div>
                  {!emailVerified && (
                    <div
                      className={styles.emailForm}
                      role="group"
                      aria-label="Verify company email"
                    >
                      <label className={styles.field}>
                        <span>{copy.step3.companyEmail}</span>
                        <input
                          type="email"
                          maxLength={254}
                          required
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                        />
                      </label>
                      <button
                        className={styles.secondaryButton}
                        disabled={busy === "email"}
                        type="button"
                        onClick={() => void issueEmail()}
                      >
                        {busy === "email"
                          ? copy.step3.queuing
                          : copy.step3.sendLink}
                      </button>
                    </div>
                  )}
                  <label className={styles.field}>
                    <span>{copy.step3.companyPhone}</span>
                    <input
                      name="companyPhone"
                      required
                      maxLength={32}
                      placeholder="0901 234 567"
                      value={String(draft.companyPhone ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, companyPhone: val }));
                      }}
                      onBlur={(e) =>
                        void saveDraft("companyPhone", e.target.value)
                      }
                    />
                    <small>{copy.step3.phoneHelp}</small>
                  </label>
                  <label className={styles.field}>
                    <span>{copy.step3.website}</span>
                    <input
                      name="website"
                      type="text"
                      maxLength={2048}
                      placeholder="company.vn"
                      value={String(draft.website ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, website: val }));
                      }}
                      onBlur={(e) =>
                        void saveDraft("website", e.target.value || null)
                      }
                    />
                    <small>{copy.step3.websiteHelp}</small>
                  </label>
                </div>
              </section>

              <section className={`${styles.card} ${styles.formCard}`}>
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>4</span>
                  <h2>{copy.step4.title}</h2>
                </div>
                <p className={styles.sectionHint}>{copy.step4.hint}</p>
                <div className={styles.form}>
                  <label className={styles.field}>
                    <span>{copy.step4.relationship}</span>
                    <select
                      name="relationship"
                      required
                      value={relationship}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, relationship: val }));
                        void saveDraft("relationship", val);
                      }}
                    >
                      <option value="">{copy.step4.selectRelationship}</option>
                      <option value="LEGAL_OWNER">
                        {copy.step4.relationships.LEGAL_OWNER}
                      </option>
                      <option value="AUTHORIZED_EMPLOYEE">
                        {copy.step4.relationships.AUTHORIZED_EMPLOYEE}
                      </option>
                      <option value="INVITED_MEMBER">
                        {copy.step4.relationships.INVITED_MEMBER}
                      </option>
                      <option value="EXISTING_OWNER_APPROVAL">
                        {copy.step4.relationships.EXISTING_OWNER_APPROVAL}
                      </option>
                      <option value="OTHER">
                        {copy.step4.relationships.OTHER}
                      </option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>{copy.step4.currentJobTitle}</span>
                    <input
                      name="currentJobTitle"
                      required
                      minLength={2}
                      maxLength={120}
                      value={String(draft.currentJobTitle ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((c) => ({ ...c, currentJobTitle: val }));
                      }}
                      onBlur={(e) =>
                        void saveDraft("currentJobTitle", e.target.value)
                      }
                    />
                  </label>
                  {authorityExplanationRequired && (
                    <label className={styles.field}>
                      <span>{copy.step4.authorityExplanation}</span>
                      <textarea
                        name="authorityExplanation"
                        required
                        minLength={20}
                        maxLength={500}
                        value={String(draft.authorityExplanation ?? "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((c) => ({
                            ...c,
                            authorityExplanation: val,
                          }));
                        }}
                        onBlur={(e) =>
                          void saveDraft("authorityExplanation", e.target.value)
                        }
                      />
                      <small>{copy.step4.authorityHelp}</small>
                    </label>
                  )}
                  <label className={`${styles.field} ${styles.fileField}`}>
                    <span>{copy.step4.businessLicense}</span>
                    <input
                      name="document"
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      required
                    />
                    <small>{copy.step4.licenseHelp}</small>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      name="accuracyDeclaration"
                      type="checkbox"
                      value="true"
                      required
                    />
                    <span>{copy.step4.accuracyDeclaration}</span>
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      name="documentProcessingConsent"
                      type="checkbox"
                      value="true"
                      required
                    />
                    <span>{copy.step4.documentConsent}</span>
                  </label>
                  <button
                    className={styles.primaryButton}
                    disabled={busy === "submit" || !emailVerified}
                    type="submit"
                  >
                    {busy === "submit"
                      ? copy.step4.submitting
                      : emailVerified
                        ? copy.step4.submitButton
                        : copy.step4.verifyEmailFirst}
                  </button>
                </div>
              </section>
            </form>
          )}
        </div>

        <aside className={`${styles.card} ${styles.trustCard}`}>
          <div className={styles.trustHead}>
            <div className={styles.trustTick} aria-hidden="true">
              ✓
            </div>
            <div>
              <h4>{copy.trust.badgeTitle}</h4>
              <p>{copy.trust.badgeDesc}</p>
            </div>
          </div>

          <div className={styles.rlabel}>{copy.trust.label}</div>
          <h3 className={styles.rtitle}>{copy.trust.title}</h3>

          <ol className={styles.signalList}>
            <li className={styles.signalItem}>
              <div
                className={`${styles.signalNum} ${styles.signalNum1}`}
                aria-hidden="true"
              >
                1
              </div>
              <div>
                <h5>{copy.trust.signal1.title}</h5>
                <p>{copy.trust.signal1.desc}</p>
              </div>
            </li>
            <li className={styles.signalItem}>
              <div
                className={`${styles.signalNum} ${styles.signalNum2}`}
                aria-hidden="true"
              >
                2
              </div>
              <div>
                <h5>{copy.trust.signal2.title}</h5>
                <p>{copy.trust.signal2.desc}</p>
              </div>
            </li>
            <li className={styles.signalItem}>
              <div
                className={`${styles.signalNum} ${styles.signalNum3}`}
                aria-hidden="true"
              >
                3
              </div>
              <div>
                <h5>{copy.trust.signal3.title}</h5>
                <p>{copy.trust.signal3.desc}</p>
              </div>
            </li>
          </ol>

          <div className={styles.humanBox}>
            <h6>{copy.trust.humanOnlyTitle}</h6>
            <p>{copy.trust.humanOnlyDesc}</p>
          </div>
        </aside>
      </div>

      <section className={styles.historySection}>
        <div className={styles.historyHeading}>
          <div>
            <p className={styles.histLabel}>{copy.history.label}</p>
            <h2 className={styles.histTitle}>{copy.history.title}</h2>
          </div>
          {items.length > 0 && (
            <span className={styles.applicationCount}>
              {items.length} {copy.history.requestsCount}
            </span>
          )}
        </div>
        {items.length ? (
          <ul className={styles.applicationList}>
            {items.map((item) => {
              const status = presentStatus(item.state, locale);
              return (
                <li className={styles.applicationCard} key={item.id}>
                  <VerificationContextRead
                    requestId={item.id}
                    csrfProof={csrfProof}
                  />
                  <div className={styles.applicationHeader}>
                    <div>
                      <strong>{item.submittedCompanyName}</strong>
                      <span>
                        {copy.history.submitted}{" "}
                        {new Date(item.createdAt).toLocaleDateString(
                          locale === "vi" ? "vi-VN" : "en-US",
                        )}
                      </span>
                    </div>
                    <span
                      className={styles.statusBadge}
                      data-tone={status.tone}
                    >
                      {status.label}
                    </span>
                  </div>
                  <dl className={styles.applicationMeta}>
                    <div>
                      <dt>{copy.history.taxId}</dt>
                      <dd>{item.normalizedTaxIdentifier}</dd>
                    </div>
                    <div>
                      <dt>{copy.history.requestedRole}</dt>
                      <dd>{item.requestedRole.toLowerCase()}</dd>
                    </div>
                    <div>
                      <dt>{copy.history.resubmissions}</dt>
                      <dd>
                        {item.resubmissionCount} {copy.history.of} 3
                      </dd>
                    </div>
                  </dl>
                  {[
                    "PENDING_CHECKS",
                    "PENDING_REVIEW",
                    "CHANGES_REQUESTED",
                  ].includes(item.state) && (
                    <button
                      className={styles.secondaryButton}
                      disabled={busy === item.id}
                      onClick={() => void cancel(item.id)}
                      type="button"
                    >
                      {copy.history.cancelRequest}
                    </button>
                  )}
                  {item.state === "CHANGES_REQUESTED" &&
                    item.resubmissionCount < 3 && (
                      <form
                        className={styles.resubmitForm}
                        onSubmit={(event) => void resubmit(item.id, event)}
                      >
                        <label className={styles.field}>
                          <span>{copy.history.replacementLicense}</span>
                          <input
                            name="document"
                            type="file"
                            accept="application/pdf,image/png,image/jpeg"
                            required
                          />
                        </label>
                        <button
                          className={styles.primaryButton}
                          disabled={busy === item.id}
                          type="submit"
                        >
                          {copy.history.resubmitEvidence}
                        </button>
                      </form>
                    )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.histEmpty}>
            <div className={styles.histIcon} aria-hidden="true">
              ⚡
            </div>
            <p>{copy.history.empty}</p>
          </div>
        )}
      </section>
    </main>
  );
}
