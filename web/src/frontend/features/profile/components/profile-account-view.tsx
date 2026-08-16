"use client";

import type { AccountIdentity } from "@/shared/contracts/account/identity";
import { useAccountIdentity } from "../client/use-account-identity";
import { ProfileNavigation } from "./profile-navigation";
import { AccountIdentityForm } from "./account-identity-form";
import { EmailChangeForm } from "./email-change-form";
import { PageHeader } from "@/frontend/components/layout/page-header";
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
    <div className="candidate-profile-page candidate-account-page">
      <ProfileNavigation active="account" accountName={state.identity.name} />
      <PageHeader
        className="candidate-profile-page__header"
        eyebrow={copy.kicker}
        title={copy.title}
        titleId="workspace-page-title"
        subtitle={copy.subtitle}
      />
      <section
        className="candidate-account-page__feedback"
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
      <div className="candidate-account-page__grid">
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
