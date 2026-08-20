import { expect, test } from "@playwright/test";

test("noir is the static document default and declares a dark color scheme", async ({ page }) => {
  await page.goto("/");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "noir");
  await expect(root).toHaveCSS("color-scheme", "dark");

  await page.getByRole("button", { name: "表示設定" }).click();
  await expect(page.getByRole("radio", { name: /テーマ：\s*ノワール/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /テーマ：\s*ライト/ })).toBeVisible();
});

test("noir and light both persist their native color scheme across reloads", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("html");

  await page.getByRole("button", { name: "表示設定" }).click();
  await page.getByRole("radio", { name: /テーマ：\s*ライト/ }).check();
  await expect(root).toHaveAttribute("data-theme", "modern");
  await expect(root).toHaveCSS("color-scheme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "modern");
  await expect(root).toHaveCSS("color-scheme", "light");

  await page.getByRole("radio", { name: /テーマ：\s*ノワール/ }).check();
  await expect(root).toHaveAttribute("data-theme", "noir");
  await expect(root).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "noir");
  await expect(root).toHaveCSS("color-scheme", "dark");
});

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

test("the static shell applies the stored theme before application content paints", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "typeloop-appearance", value: "classic.compact.reduced", url: "http://127.0.0.1:4173" },
  ]);
  const html = await (await context.request.get("/")).text();
  expect(html).toMatch(/<html[^>]*data-theme="noir"/);
  expect(html).toContain("/theme-bootstrap.js");
  const settingsHtml = await (await context.request.get("/settings")).text();
  expect(settingsHtml).not.toContain('type="radio"');

  const page = await context.newPage();
  await page.addInitScript(() => {
    const observedThemes: string[] = [];
    Object.assign(globalThis, { __typeLoopObservedThemes: observedThemes });
    new MutationObserver(() => observedThemes.push(document.documentElement?.dataset.theme ?? "")).observe(document, {
      attributes: true,
      attributeFilter: ["data-theme"],
      subtree: true,
    });
  });
  await page.goto("/settings");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "classic");
  await expect(root).toHaveAttribute("data-density", "compact");
  await expect(root).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByRole("radio", { name: /テーマ：\s*クラシック/ })).toBeChecked();
  const observedThemes = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __typeLoopObservedThemes: string[];
        }
      ).__typeLoopObservedThemes,
  );
  const firstClassic = observedThemes.indexOf("classic");
  expect(firstClassic).toBeGreaterThanOrEqual(0);
  expect(observedThemes.slice(firstClassic + 1)).not.toContain("noir");
  await context.close();
});

test("a hand-edited cookie cannot put unvalidated values into the HTML", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addCookies([
    { name: "typeloop-appearance", value: '../evil."><script>.none', url: "http://127.0.0.1:4173" },
  ]);
  const html = await (await context.request.get("/")).text();
  // The CDN document is invariant; the browser bootstrap validates every field.
  expect(html).toMatch(/<html[^>]*data-theme="noir"/);
  expect(html).not.toContain("evil");
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "noir");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
  await context.close();
});

test("choosing a theme persists it for the next static-shell navigation", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();
  await page.getByRole("radio", { name: /テーマ：\s*クラシック/ }).check();

  const cookie = (await context.cookies()).find((entry) => entry.name === "typeloop-appearance");
  expect(cookie?.value, "the choice must reach the pre-paint bootstrap").toMatch(/^classic\./);

  const html = await (await context.request.get("/")).text();
  expect(html).toMatch(/<html[^>]*data-theme="noir"/);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "classic");
});
