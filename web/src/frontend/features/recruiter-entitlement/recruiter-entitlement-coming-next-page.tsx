"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspaceLocale } from "@/frontend/features/dashboard/client/workspace-locale";
type Entitlement = {
  available: boolean;
  requiresSelection: boolean;
  selectedCompanyId: string | null;
  companies: Array<{ companyId: string; companyName: string; role: string }>;
  destinations: Array<{ label: string; href: string }>;
};
export function RecruiterEntitlementComingNextPage() {
  const [data, setData] = useState<Entitlement>();
  const [selected, setSelected] = useState("");
  const vi = useWorkspaceLocale() === "vi";
  const copy = vi
      ? {
          checking: "Đang kiểm tra quyền truy cập công ty…",
          title: "Không gian nhà tuyển dụng sắp ra mắt",
          companyContext: "Ngữ cảnh công ty",
          selectCompany: "Chọn công ty",
          candidateDashboard: "Bảng điều khiển ứng viên",
          employerVerification: "Xác minh nhà tuyển dụng",
          roles: {
            OWNER: "Chủ sở hữu",
            HR_MANAGER: "Quản lý nhân sự",
            RECRUITER: "Nhà tuyển dụng",
            HIRING_MANAGER: "Quản lý tuyển dụng",
          },
          unavailable:
            "Tính năng quản lý nhà tuyển dụng chưa khả dụng với ngữ cảnh công ty hiện tại.",
          destinations: "Điểm đến khả dụng",
      }
    : {
        checking: "Checking company access…",
        title: "Recruiter workspace is coming next",
        companyContext: "Company context",
        selectCompany: "Select a company",
        candidateDashboard: "Candidate Dashboard",
        employerVerification: "Employer Verification",
        roles: {
          OWNER: "Owner",
          HR_MANAGER: "HR Manager",
          RECRUITER: "Recruiter",
          HIRING_MANAGER: "Hiring Manager",
        },
        unavailable:
          "Recruiter management is unavailable for the current company context.",
        destinations: "Available destinations",
      };
  const roleLabel = (role: string) =>
    (copy.roles as Record<string, string>)[role] ?? role;
  const destinationLabel = (label: string) =>
    label === "Candidate Dashboard"
      ? copy.candidateDashboard
      : label === "Employer Verification"
        ? copy.employerVerification
        : label;
  async function load(companyId?: string) {
    const response = await fetch(
      `/api/recruiter/entitlement${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    setData(await response.json());
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/recruiter/entitlement", {
      cache: "no-store",
      credentials: "same-origin",
    }).then(async (response) => {
      if (active) setData(await response.json());
    });
    return () => {
      active = false;
    };
  }, []);
  if (!data)
    return (
      <main>
        <p role="status">{copy.checking}</p>
      </main>
    );
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl content-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">{copy.title}</h1>
      {data.companies.length > 1 && (
        <label className="grid gap-2">
          {copy.companyContext}
          <select
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              void load(event.target.value);
            }}
          >
            <option value="">{copy.selectCompany}</option>
            {data.companies.map((company) => (
              <option key={company.companyId} value={company.companyId}>
                {company.companyName} — {roleLabel(company.role)}
              </option>
            ))}
          </select>
        </label>
      )}
      {!data.available && <p>{copy.unavailable}</p>}
      <nav aria-label={copy.destinations}>
        <ul className="grid gap-3">
          {data.destinations.map((item) => (
            <li key={item.label}>
              <Link href={item.href}>{destinationLabel(item.label)}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
