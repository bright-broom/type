import Link from "next/link";
import { PageShell } from "../layout/PageShell.tsx";
import styles from "./PrivacyScreen.module.css";

export function PrivacyScreen() {
  return (
    <PageShell width="reading" className={styles.root}>
      <header className={styles.heading}>
        <span className="section-index">PRIVACY &amp; SAFETY</span>
        <h1>プライバシーと安全性</h1>
        <p>TypeLoopは、アカウントや外部送信を前提にしないローカルファーストの学習アプリです。</p>
      </header>

      <section className={styles.section} aria-labelledby="not-collected">
        <h2 id="not-collected">外部送信・完了後に保存しないもの</h2>
        <ul>
          <li>氏名、メールアドレス、住所などのプロフィール情報</li>
          <li>広告識別子、アクセス解析、行動追跡データ</li>
          <li>タイピングした文字列やキー入力の時系列（練習中の判定にだけ使用）</li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="stored-locally">
        <h2 id="stored-locally">この端末に保存するもの</h2>
        <ul>
          <li>練習日時、WPM、正確性、スコア、弱キーの集計</li>
          <li>宅建演習の回答状況と端末内の試験履歴</li>
          <li>サウンド設定と、表示テーマ用のCookie</li>
        </ul>
        <p>ブラウザのサイトデータを削除すると消去できます。練習履歴はJSONとして手元へ保存できます。</p>
      </section>

      <section className={styles.section} aria-labelledby="safe-use">
        <h2 id="safe-use">安全に使うために</h2>
        <p>
          共有端末では、同じブラウザを使う人が履歴を閲覧できる場合があります。機密情報や認証情報を入力せず、利用後は必要に応じてサイトデータを削除してください。
        </p>
      </section>

      <Link className={styles.back} href="/">
        ← TypeLoopへ戻る
      </Link>
    </PageShell>
  );
}
