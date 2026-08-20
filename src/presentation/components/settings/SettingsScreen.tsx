import {
  DISPLAY_DENSITIES,
  MOTION_PREFERENCES,
  THEME_IDS,
  type AppearanceSettings,
  type DisplayDensity,
  type MotionPreference,
  type ThemeId,
} from "../../../application/settings/app-settings.ts";
import { PageShell } from "../layout/PageShell.tsx";

type SettingsScreenProps = {
  appearance: AppearanceSettings;
  onChange: (appearance: AppearanceSettings) => void;
  onBack: () => void;
};

const THEME_LABELS: Record<ThemeId, { label: string; detail: string }> = {
  noir: { label: "ノワール", detail: "黒を基調に、集中と視認性を高めた既定デザイン" },
  modern: { label: "ライト", detail: "明るい背景と余白を活かしたモダンデザイン" },
  classic: { label: "クラシック", detail: "落ち着いた従来配色に近いデザイン" },
};

const DENSITY_LABELS: Record<DisplayDensity, string> = {
  comfortable: "標準",
  compact: "コンパクト",
};

const MOTION_LABELS: Record<MotionPreference, string> = {
  system: "端末の設定に合わせる",
  reduced: "動きを減らす",
};

export function SettingsScreen({ appearance, onChange, onBack }: SettingsScreenProps) {
  const update = <Key extends keyof AppearanceSettings>(key: Key, value: AppearanceSettings[Key]) => {
    onChange({ ...appearance, [key]: value });
  };

  return (
    <PageShell
      width="compact"
      spacing="compact"
      className="settings-shell"
      data-overlay-root
      tabIndex={-1}
      aria-labelledby="settings-title"
    >
      <header className="settings-heading">
        <button className="text-button" type="button" onClick={onBack}>
          <span>←</span> 戻る
        </button>
        <span className="section-index">APPEARANCE</span>
        <h1 id="settings-title">表示設定</h1>
        <p>変更はこのデバイスに保存され、すべての画面へすぐ反映されます。</p>
      </header>

      <div className="settings-groups">
        <fieldset className="settings-group">
          <legend>テーマ</legend>
          <div className="theme-options">
            {THEME_IDS.map((themeId) => (
              <label key={themeId} className="settings-option">
                <span className="a11y-only">テーマ：</span>
                <input
                  type="radio"
                  name="theme"
                  checked={appearance.themeId === themeId}
                  onChange={() => update("themeId", themeId)}
                />
                <span className={`theme-swatch theme-swatch--${themeId}`} aria-hidden="true" />
                <span>
                  <strong>{THEME_LABELS[themeId].label}</strong>
                  <small>{THEME_LABELS[themeId].detail}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="settings-group settings-group--inline">
          <legend>表示密度</legend>
          {DISPLAY_DENSITIES.map((density) => (
            <label key={density}>
              <span className="a11y-only">表示密度：</span>
              <input
                type="radio"
                name="density"
                checked={appearance.density === density}
                onChange={() => update("density", density)}
              />
              <span>{DENSITY_LABELS[density]}</span>
            </label>
          ))}
        </fieldset>

        <label className="settings-select">
          <span>モーション</span>
          <select
            value={appearance.motion}
            onChange={(event) => update("motion", event.target.value as MotionPreference)}
          >
            {MOTION_PREFERENCES.map((motion) => (
              <option key={motion} value={motion}>
                {MOTION_LABELS[motion]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </PageShell>
  );
}
