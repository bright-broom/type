import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares an App Router home route and finished TypeLoop shell", async () => {
  const [page, layout, app, playbook] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/TypingApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/consulting/ConsultingPlaybook.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /export default function Home/);
  assert.match(page, /TypingApp/);
  assert.match(layout, /<html lang="ja">/);
  assert.match(playbook, /コンサル実務辞典/);
  assert.match(app, /HomeScreen/);
});
