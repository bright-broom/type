"use client";

import { lazy } from "react";
import type { AppearanceSettings } from "../../../application/settings/app-settings.ts";
import type { CompletedSession } from "../../../application/session/session-types.ts";
import type { TrainingSet } from "../../../domain/prompts/prompt-types.ts";
import type { AppOverlay } from "../../hooks/useAppRoute.ts";
import { HistoryScreen } from "../history/HistoryScreen.tsx";
import { PageShell } from "../layout/PageShell.tsx";
import { SettingsScreen } from "../settings/SettingsScreen.tsx";

const ConsultingPlaybook = lazy(() =>
  import("../consulting/ConsultingPlaybook.tsx").then((module) => ({ default: module.ConsultingPlaybook })),
);
const TakkenGlossary = lazy(() =>
  import("../takken/TakkenGlossary.tsx").then((module) => ({ default: module.TakkenGlossary })),
);
const AisGlossary = lazy(() => import("../ais/AisGlossary.tsx").then((module) => ({ default: module.AisGlossary })));

type ReferenceOverlayProps = {
  overlay: Exclude<AppOverlay, "none">;
  appearance: AppearanceSettings;
  appearanceReady: boolean;
  sessions: ReadonlyArray<CompletedSession>;
  onAppearanceChange: (appearance: AppearanceSettings) => void;
  onBack: () => void;
  onSave: () => Promise<boolean>;
  onStart: (trainingSet: TrainingSet) => void;
};

export function ReferenceOverlay({
  overlay,
  appearance,
  appearanceReady,
  sessions,
  onAppearanceChange,
  onBack,
  onSave,
  onStart,
}: ReferenceOverlayProps) {
  if (overlay === "settings" && !appearanceReady) {
    return (
      <PageShell width="compact" centered role="status">
        表示設定を読み込んでいます…
      </PageShell>
    );
  }
  if (overlay === "settings") {
    return <SettingsScreen appearance={appearance} onChange={onAppearanceChange} onBack={onBack} />;
  }
  if (overlay === "history") {
    return <HistoryScreen sessions={sessions} onBack={onBack} onSave={onSave} />;
  }
  return overlay === "ais" ? (
    <AisGlossary onBack={onBack} onStart={() => onStart("ais")} />
  ) : overlay === "takken" ? (
    <TakkenGlossary onBack={onBack} onStart={() => onStart("takken")} />
  ) : (
    <ConsultingPlaybook onBack={onBack} onStart={() => onStart("consulting")} />
  );
}
