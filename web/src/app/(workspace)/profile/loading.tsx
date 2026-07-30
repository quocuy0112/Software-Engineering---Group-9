export default function ProfileLoading() {
  return (
    <div
      className="profile-page profile-page--standalone"
      aria-busy="true"
      aria-live="polite"
    >
      <header className="page-heading profile-heading">
        <div>
          <p className="workspace-kicker">ACCOUNT &amp; ACCESS</p>
          <h1 id="workspace-page-title">Loading profile...</h1>
          <p className="page-heading-copy" role="status">
            Preparing your secure account details.
          </p>
        </div>
      </header>
    </div>
  );
}
