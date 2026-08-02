"use client";

import type { AccountIdentity } from "@/shared/contracts/account/identity";
import { useAccountIdentity } from "../client/use-account-identity";
import { ProfileNavigation } from "./profile-navigation";
import { AccountIdentityForm } from "./account-identity-form";
import { EmailChangeForm } from "./email-change-form";
import { useWorkspaceLocale } from "../../dashboard/client/workspace-locale";

export function ProfileAccountView({
  initialIdentity,
  csrfProof,
}: {
  initialIdentity: AccountIdentity;
  csrfProof: string;
}) {
  const state = useAccountIdentity(initialIdentity, csrfProof);
  const locale = useWorkspaceLocale();
  const copy =
    locale === "vi"
      ? {
          kicker: "TÀI KHOẢN CỦA BẠN",
          title: "Thông tin tài khoản",
          subtitle:
            "Quản lý tên tài khoản và email đăng nhập đã xác minh, tách biệt với hồ sơ nghề nghiệp.",
          feedback: "Phản hồi tài khoản",
        }
      : {
          kicker: "YOUR ACCOUNT",
          title: "Account identity",
          subtitle:
            "Manage your account name and verified login email separately from your professional profile.",
          feedback: "Account feedback",
        };
  return (
    <div className="profile-page account-identity-page">
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy">{copy.subtitle}</p>
        </div>
      </header>
      <ProfileNavigation active="account" />
      <section
        className="account-identity-feedback"
        aria-label={copy.feedback}
        aria-live="polite"
        aria-atomic="true"
      >
        {state.feedback ? (
          <p
            role={state.feedback.kind === "error" ? "alert" : "status"}
            data-feedback-kind={state.feedback.kind}
          >
            {state.feedback.message}
          </p>
        ) : null}
      </section>
      <div className="account-identity-grid">
        <AccountIdentityForm
          identity={state.identity}
          saving={state.savingName}
          onSave={state.saveName}
        />
        <EmailChangeForm
          pending={state.identity.pendingEmailChange}
          requesting={state.requestingEmail}
          onRequest={state.requestEmailChange}
        />
      </div>
    </div>
  );
}
