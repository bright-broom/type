import Link from "next/link";

export function TakkenSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame takken-site-frame">
      <header className="app-header takken-site-header">
        <Link className="brand" href="/" aria-label="TypeLoop ホーム">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>TypeLoop</span>
        </Link>
        <nav className="header-actions" aria-label="宅建学習ナビゲーション">
          <Link className="header-link" href="/takken">
            宅建ホーム
          </Link>
          <Link className="header-link" href="/takken/history">
            試験記録
          </Link>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        <span>TYPELOOP / TAKKEN ASSESSMENT</span>
        <span>LOCAL FIRST · ORIGINAL QUESTIONS</span>
      </footer>
    </div>
  );
}
