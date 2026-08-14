export function CountdownScreen({ value }: { value: number }) {
  return (
    <main className="countdown-shell" aria-live="assertive">
      <p>指をホームポジションへ</p>
      <strong key={value}>{value || 3}</strong>
      <span>まもなくスタート</span>
    </main>
  );
}
