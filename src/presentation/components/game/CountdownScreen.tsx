import { PageShell } from "../layout/PageShell.tsx";

export function CountdownScreen({ value }: { value: number }) {
  return (
    <PageShell width="game" spacing="none" centered className="countdown-shell" aria-live="assertive">
      <p>指をホームポジションへ</p>
      <strong key={value}>{value || 3}</strong>
      <span>まもなくスタート</span>
    </PageShell>
  );
}
