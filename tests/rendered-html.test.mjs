import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares an App Router home route and finished TypeLoop shell", async () => {
  const [page, layout, app, reference, playbook, takken, privacy, game, keyboardInput, styles, themes] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/TypingApp.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/reference/ReferenceOverlay.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/consulting/ConsultingPlaybook.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/takken/TakkenGlossary.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/privacy/PrivacyScreen.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/components/game/GameScreen.tsx", import.meta.url), "utf8"),
      readFile(new URL("../src/presentation/hooks/useKeyboardInput.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../app/styles/themes.css", import.meta.url), "utf8"),
    ]);
  assert.match(page, /export default function Home/);
  assert.match(page, /TypingApp/);
  assert.match(layout, /<html lang="ja"[^>]*>/);
  assert.match(playbook, /コンサル実務辞典/);
  assert.match(takken, /宅建試験 完全用語一覧/);
  assert.match(privacy, /外部送信・完了後に保存しないもの/);
  assert.match(reference, /TakkenGlossary/);
  assert.doesNotMatch(reference, /AisGlossary/);
  assert.match(app, /HomeScreen/);
  assert.match(app, /TypingInput/);
  assert.match(game, /英数字キーボードに切り替え/);
  assert.match(keyboardInput, /isForeignEditableTarget/);
  assert.match(keyboardInput, /isInteractiveTarget/);
  assert.match(keyboardInput, /isTypingField/);
  assert.match(styles, /--keyboard-inset/);
  assert.match(themes, /--page-gutter/);
  // The invariant CDN shell starts from safe defaults, then the parser-blocking
  // same-origin bootstrap applies the validated cookie before application paint.
  assert.match(layout, /appearanceDataAttributes/);
  assert.doesNotMatch(layout, /cookies\(\)|next\/headers/);
  assert.match(layout, /src="\/theme-bootstrap\.js"/);
  assert.doesNotMatch(layout, /next\/script|beforeInteractive/);
  assert.match(styles, /pointer: coarse/);
});
