import { getWorkspaceContext } from "@/backend/auth/get-workspace-context";

function profileLoadingCopy(locale: "vi" | "en") {
  return locale === "vi"
    ? {
        kicker: "TÀI KHOẢN VÀ QUYỀN TRUY CẬP",
        title: "Đang tải hồ sơ…",
        description: "Đang chuẩn bị thông tin tài khoản bảo mật của bạn.",
      }
    : {
        kicker: "ACCOUNT & ACCESS",
        title: "Loading profile…",
        description: "Preparing your secure account details.",
      };
}

export default async function ProfileLoading() {
  const context = await getWorkspaceContext();
  const copy = profileLoadingCopy(context?.initialLocale ?? "en");
  return (
    <div
      className="profile-page profile-page--standalone"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">{copy.kicker}</p>
          <h1 id="workspace-page-title">{copy.title}</h1>
          <p className="page-heading-copy" role="status">
            {copy.description}
          </p>
        </div>
      </header>
    </div>
  );
}
