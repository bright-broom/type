import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares an App Router home route and finished TypeLoop shell", async () => {
  const [page, layout, app, playbook, takken, ais, game, keyboardInput, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/components/TypingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/components/consulting/ConsultingPlaybook.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/components/takken/TakkenGlossary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/components/ais/AisGlossary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/components/game/GameScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/presentation/hooks/useKeyboardInput.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /export default function Home/);
  assert.match(page, /TypingApp/);
  assert.match(layout, /<html lang="ja">/);
  assert.match(playbook, /コンサル実務辞典/);
  assert.match(takken, /宅建試験 完全用語一覧/);
  assert.match(ais, /非開示処理済み/);
  assert.match(app, /TakkenGlossary/);
  assert.match(app, /AisGlossary/);
  assert.match(app, /HomeScreen/);
  assert.match(game, /TypingInput/);
  assert.match(keyboardInput, /isEditableTarget/);
  assert.match(styles, /--page-gutter/);
  assert.match(styles, /pointer: coarse/);
});
