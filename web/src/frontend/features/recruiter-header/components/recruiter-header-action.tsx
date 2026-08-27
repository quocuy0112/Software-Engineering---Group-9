"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRecruiterHeaderNavigation } from "../client/use-recruiter-header-navigation";
import { useRecruiterHeaderStatus } from "../client/use-recruiter-header-status";
import {
  useWorkspaceLocale,
  type WorkspaceLocale,
} from "@/frontend/features/dashboard/client/workspace-locale";
import {
  EMPLOYER_VERIFICATION_HREF,
  type RecruiterHeaderStatus,
} from "@/shared/contracts/recruiter-header-status";

type RecruiterHeaderIconName = "pending" | "approved" | "apply";

type CompanyActionDropdownPosition = {
  top: number;
  left: number;
  width: number;
};

const COMPANY_ACTION_DROPDOWN_GAP = 8;
const COMPANY_ACTION_DROPDOWN_GUTTER = 16;
const COMPANY_ACTION_DROPDOWN_MIN_WIDTH = 176;

function RecruiterHeaderIcon({ name }: { name: RecruiterHeaderIconName }) {
  const content =
    name === "pending" ? (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>
    ) : name === "approved" ? (
      <path d="M5 12h13m-5-5 5 5-5 5" />
    ) : (
      <path d="M12 5v14M5 12h14" />
    );
  return (
    <svg
      className="recruiter-header-action__svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}

type RecruiterHeaderNavigationState = {
  busy: boolean;
  open: (href: string | null) => boolean;
};

function recruiterHeaderCopy(locale: WorkspaceLocale) {
  return locale === "vi"
    ? {
        hideCreateCompany: "Ẩn Tạo công ty",
        showCreateCompany: "Hiện Tạo công ty",
        createCompany: "Tạo công ty",
        checkingStatus: "Đang kiểm tra trạng thái",
        applicationUnderReview: "Đơn đăng ký đang được xem xét",
        updateApplication: "Cập nhật đơn đăng ký",
        reapplyAsRecruiter: "Đăng ký lại với vai trò nhà tuyển dụng",
        postJob: "Đăng tin tuyển dụng",
        recruiterWorkspace: "Không gian nhà tuyển dụng",
      }
    : {
        hideCreateCompany: "Hide Create a Company",
        showCreateCompany: "Show Create a Company",
        createCompany: "Create a Company",
        checkingStatus: "Checking status",
        applicationUnderReview: "Application Under Review",
        updateApplication: "Update Application",
        reapplyAsRecruiter: "Reapply as Recruiter",
        postJob: "Post a Job",
        recruiterWorkspace: "Recruiter Workspace",
      };
}

function RecruiterHeaderCompanyActions({
  action,
  navigation,
  copy,
}: {
  action: ReactNode;
  navigation: RecruiterHeaderNavigationState;
  copy: ReturnType<typeof recruiterHeaderCopy>;
}) {
  const [showCompanyActions, setShowCompanyActions] = useState(false);
  const [dropdownPosition, setDropdownPosition] =
    useState<CompanyActionDropdownPosition | null>(null);
  const actionGroupRef = useRef<HTMLDivElement>(null);
  const companyActionRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!showCompanyActions) return;

    const updateDropdownPosition = () => {
      const anchor = actionGroupRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const availableWidth = Math.max(
        window.innerWidth - COMPANY_ACTION_DROPDOWN_GUTTER * 2,
        COMPANY_ACTION_DROPDOWN_MIN_WIDTH,
      );
      const width = Math.min(
        Math.max(rect.width, COMPANY_ACTION_DROPDOWN_MIN_WIDTH),
        availableWidth,
      );
      const maxLeft = Math.max(
        window.innerWidth - COMPANY_ACTION_DROPDOWN_GUTTER - width,
        COMPANY_ACTION_DROPDOWN_GUTTER,
      );
      const left = Math.min(
        Math.max(rect.right - width, COMPANY_ACTION_DROPDOWN_GUTTER),
        maxLeft,
      );

      setDropdownPosition({
        top: rect.bottom + COMPANY_ACTION_DROPDOWN_GAP,
        left,
        width,
      });
    };

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showCompanyActions]);

  useEffect(() => {
    if (!showCompanyActions) return;

    const closeOnOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        actionGroupRef.current?.contains(target) ||
        companyActionRef.current?.contains(target)
      ) {
        return;
      }
      setShowCompanyActions(false);
      setDropdownPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowCompanyActions(false);
      setDropdownPosition(null);
    };

    document.addEventListener("mousedown", closeOnOutsideInteraction);
    document.addEventListener("touchstart", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideInteraction);
      document.removeEventListener("touchstart", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showCompanyActions]);

  return (
    <>
      <div ref={actionGroupRef} className="recruiter-header-action-group">
        <div className="recruiter-header-action-group__primary">
          {action}
          <button
            type="button"
            className="recruiter-header-action-group__toggle"
            aria-expanded={showCompanyActions}
            aria-controls="recruiter-company-actions"
            aria-label={
              showCompanyActions
                ? copy.hideCreateCompany
                : copy.showCreateCompany
            }
            onClick={() => {
              if (showCompanyActions) setDropdownPosition(null);
              setShowCompanyActions((current) => !current);
            }}
          >
            <span aria-hidden="true">{showCompanyActions ? "−" : "+"}</span>
          </button>
        </div>
      </div>
      {showCompanyActions && dropdownPosition && typeof document !== "undefined"
        ? createPortal(
            <button
              ref={companyActionRef}
              id="recruiter-company-actions"
              type="button"
              className="recruiter-header-action recruiter-header-action--secondary recruiter-header-action--create-company"
              aria-busy={navigation.busy || undefined}
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                minWidth: dropdownPosition.width,
              }}
              onClick={() => navigation.open(EMPLOYER_VERIFICATION_HREF)}
            >
              <span
                className="recruiter-header-action__icon"
                aria-hidden="true"
              >
                <RecruiterHeaderIcon name="apply" />
              </span>
              <span className="recruiter-header-action__label">
                {copy.createCompany}
              </span>
            </button>,
            document.body,
          )
        : null}
    </>
  );
}

export function RecruiterHeaderAction({
  initialStatus,
  onOpenWorkspace,
}: {
  initialStatus?: RecruiterHeaderStatus | null;
  onOpenWorkspace?: () => void;
}) {
  const copy = recruiterHeaderCopy(useWorkspaceLocale());
  const { status, checking, unavailable } =
    useRecruiterHeaderStatus(initialStatus);
  const navigation = useRecruiterHeaderNavigation();
  const approved = status?.state === "APPROVED";

  if (!status) {
    return (
      <span
        className="recruiter-header-action recruiter-header-action--placeholder"
        role="status"
        aria-live="polite"
        aria-label={copy.checkingStatus}
        data-recruiter-state="placeholder"
      >
        <span className="recruiter-header-action__icon" aria-hidden="true" />
        <span className="recruiter-header-action__label">
          {copy.checkingStatus}
        </span>
      </span>
    );
  }

  const pending = status.state === "PENDING_REVIEW";
  const label = pending
    ? copy.applicationUnderReview
    : status.state === "CHANGES_REQUESTED"
      ? copy.updateApplication
      : status.state === "REJECTED"
        ? copy.reapplyAsRecruiter
        : approved
          ? onOpenWorkspace
            ? copy.postJob
            : copy.recruiterWorkspace
          : copy.createCompany;
  const busy = checking || navigation.busy;
  const state = unavailable
    ? "unavailable"
    : busy
      ? "revalidating"
      : status.state.toLowerCase();

  const action = (
    <button
      type="button"
      className={[
        "recruiter-header-action",
        approved || status.state === "NEVER_APPLIED"
          ? "recruiter-header-action--primary"
          : "recruiter-header-action--secondary",
      ].join(" ")}
      aria-disabled={pending || busy ? true : undefined}
      aria-busy={busy || undefined}
      data-recruiter-state={state}
      tabIndex={pending ? 0 : undefined}
      onClick={() => {
        if (pending || busy) return;
        if (approved && onOpenWorkspace) {
          onOpenWorkspace();
          return;
        }
        navigation.open(status.href);
      }}
      onKeyDown={(event) => {
        if (pending || busy) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
          }
        }
      }}
    >
      <span className="recruiter-header-action__icon" aria-hidden="true">
        <RecruiterHeaderIcon
          name={pending ? "pending" : approved ? "approved" : "apply"}
        />
      </span>
      <span className="recruiter-header-action__label">{label}</span>
    </button>
  );

  if (!approved || !onOpenWorkspace) return action;

  return (
    <RecruiterHeaderCompanyActions
      action={action}
      navigation={navigation}
      copy={copy}
    />
  );
}
