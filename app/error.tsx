"use client";

import { PageShell } from "../src/presentation/components/layout/PageShell.tsx";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PageShell width="compact" centered className="error-shell" role="alert">
      <span>TYPELOOP</span>
      <h1>うまく読み込めませんでした。</h1>
      <p>入力データは外部へ送信されていません。もう一度読み込みをお試しください。</p>
      <button className="primary-button" type="button" onClick={reset}>
        <span>もう一度試す</span>
      </button>
    </PageShell>
  );
}
