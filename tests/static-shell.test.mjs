import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);

test("the root shell has no request-time rendering dependency", async () => {
  const [layout, home, glossary] = await Promise.all([
    readFile(new URL("app/layout.tsx", ROOT), "utf8"),
    readFile(new URL("app/page.tsx", ROOT), "utf8"),
    readFile(new URL("app/takken/glossary/page.tsx", ROOT), "utf8"),
  ]);
  for (const source of [layout, home, glossary]) {
    assert.doesNotMatch(source, /next\/headers|\bcookies\(|\bheaders\(|searchParams/);
  }
  assert.match(layout, /theme-bootstrap\.js/);
  assert.match(layout, /<script/);
  assert.doesNotMatch(layout, /next\/script|beforeInteractive/);
  assert.match(layout, /DEFAULT_APPEARANCE/);
  assert.match(home, /export const metadata/);
});

test("reference destinations own stable deep links", async () => {
  const [route, contract] = await Promise.all([
    readFile(new URL("src/presentation/hooks/useAppRoute.ts", ROOT), "utf8"),
    readFile(new URL("src/presentation/hooks/reference-route.ts", ROOT), "utf8"),
  ]);
  for (const path of ["/settings", "/history", "/consulting", "/ais", "/takken/glossary"]) {
    assert.match(contract, new RegExp(`"${path}"`));
  }
  assert.match(route, /popstate/);
  assert.match(route, /history\.back/);
});
