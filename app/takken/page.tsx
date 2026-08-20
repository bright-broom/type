import Link from "next/link";
import { formatEditionDate, TAKKEN_EDITION, TAKKEN_EXAM_YEAR } from "../../src/content/takken/takken-edition.ts";
import { PageShell } from "../../src/presentation/components/layout/PageShell.tsx";

export default function TakkenHomePage() {
  return (
    <PageShell width="assessment" className="takken-hub assessment-reading-shell">
      <section className="takken-hub-hero">
        <span className="section-index">TYPELOOP / TAKKEN {TAKKEN_EXAM_YEAR}</span>
        <h1>
          覚える。解く。
          <br />
          <em>また戻る。</em>
        </h1>
        <p>用語タイピングと4択演習をつなぎ、理解できていない論点を反復する宅建学習スペースです。</p>
      </section>
      <section className="takken-path-grid" aria-label="宅建学習メニュー">
        <Link href="/takken/practice">
          <span>01 / PRACTICE</span>
          <h2>10問演習</h2>
          <p>分野を選び、回答直後に解説を確認。</p>
          <strong>始める →</strong>
        </Link>
        <Link href="/takken/mock">
          <span>02 / SIMULATION</span>
          <h2>本番模試</h2>
          <p>50問120分、または5問免除45問110分。</p>
          <strong>設定する →</strong>
        </Link>
        <Link href="/takken/glossary">
          <span>03 / REFERENCE</span>
          <h2>宅建用語集</h2>
          <p>{TAKKEN_EDITION.label}・全446語を検索して確認。</p>
          <strong>調べる →</strong>
        </Link>
        <Link href="/?training=takken">
          <span>04 / TYPING</span>
          <h2>用語タイピング</h2>
          <p>覚え直した用語を60秒で定着。</p>
          <strong>練習する →</strong>
        </Link>
      </section>
      <aside className="takken-exam-facts">
        <div>
          <span>試験日</span>
          <strong>{formatEditionDate(TAKKEN_EDITION.examDate, "dots")}</strong>
        </div>
        <div>
          <span>形式</span>
          <strong>50問・四肢択一</strong>
        </div>
        <div>
          <span>法令基準日</span>
          <strong>{formatEditionDate(TAKKEN_EDITION.legalBasisDate, "dots")}</strong>
        </div>
      </aside>
    </PageShell>
  );
}
