"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-shell" role="alert">
      <span>TYPELOOP</span>
      <h1>うまく読み込めませんでした。</h1>
      <p>入力データは外部へ送信されていません。もう一度読み込みをお試しください。</p>
      <button className="primary-button" type="button" onClick={reset}>
        <span>もう一度試す</span>
      </button>
    </main>
  );
}
