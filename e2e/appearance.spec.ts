import { expect, test } from "@playwright/test";

test("appearance changes immediately and survives a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();

  await page.getByRole("radio", { name: /テーマ：\s*クラシック/ }).check();
  await page.getByRole("radio", { name: /表示密度：\s*コンパクト/ }).check();
  await page.getByLabel("モーション").selectOption("reduced");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "classic");
  await expect(root).toHaveAttribute("data-density", "compact");
  await expect(root).toHaveAttribute("data-motion", "reduced");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "classic");
  await expect(root).toHaveAttribute("data-density", "compact");
  await expect(root).toHaveAttribute("data-motion", "reduced");
});

test("appearance settings remain usable on a phone viewport", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();

  const controls = page.locator(
    ".settings-option, .settings-group--inline label, .settings-select select, .settings-shell button",
  );
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box, "settings control must have a rendered box").not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
  await context.close();
});

test("the stored theme is in the server-rendered HTML, so nothing can flash", async ({ browser }) => {
  // The definitive check: the attributes arrive with the document, before any script
  // runs. A client-side restore could not do this — React serialises an inline script
  // into its flight payload, which executes after the first paint (see ADR-014).
  const context = await browser.newContext();
  await context.addCookies([
    { name: "typeloop-appearance", value: "classic.compact.reduced", url: "http://127.0.0.1:4173" },
  ]);
  const html = await (await context.request.get("/")).text();
  expect(html).toMatch(/<html[^>]*data-theme="classic"/);
  expect(html).toMatch(/<html[^>]*data-density="compact"/);
  expect(html).toMatch(/<html[^>]*data-motion="reduced"/);
  expect(html, "no bootstrap script should remain").not.toContain("typeloop-appearance=");
  await context.close();
});

test("a hand-edited cookie cannot put unvalidated values into the HTML", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "typeloop-appearance", value: '../evil."><script>.none', url: "http://127.0.0.1:4173" },
  ]);
  const html = await (await context.request.get("/")).text();
  // Falls back per field, and the rendered attribute values stay allow-listed.
  expect(html).toMatch(/<html[^>]*data-theme="modern"/);
  expect(html).toMatch(/<html[^>]*data-motion="system"/);
  expect(html).not.toContain("evil");
  await context.close();
});

test("choosing a theme persists it for the next server render", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();
  await page.getByRole("radio", { name: /テーマ：\s*クラシック/ }).check();

  const cookie = (await context.cookies()).find((entry) => entry.name === "typeloop-appearance");
  expect(cookie?.value, "the choice must reach the cookie the server reads").toMatch(/^classic\./);

  const html = await (await context.request.get("/")).text();
  expect(html).toMatch(/<html[^>]*data-theme="classic"/);
});
