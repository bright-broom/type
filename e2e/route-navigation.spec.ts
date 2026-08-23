import { expect, test } from "@playwright/test";

const REFERENCE_ROUTES = [
  { path: "/settings", heading: "表示設定" },
  { path: "/history", heading: "練習の記録" },
  { path: "/consulting", heading: "コンサル実務辞典" },
  { path: "/privacy", heading: "プライバシーと安全性" },
  { path: "/takken/glossary", heading: "宅建試験 完全用語一覧" },
] as const;

for (const route of REFERENCE_ROUTES) {
  test(`${route.path} is a reloadable application destination`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).toHaveURL(new RegExp(`${route.path.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    if (route.path === "/settings") await expect(page.locator("[data-overlay-root]")).toBeFocused();
    await page.reload();
    await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    if (route.path === "/settings") await expect(page.locator("[data-overlay-root]")).toBeFocused();
  });
}

test("browser Back restores the home task and its invoking control", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "表示設定" });
  await trigger.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
  await expect(trigger).toBeFocused();

  await page.goForward();
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
  await page.goBack();
  await expect(trigger).toBeFocused();
});

test("a direct reference route has a deterministic in-app home return", async ({ page }) => {
  await page.goto("/consulting");
  await page.getByRole("button", { name: /ホームへ/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
  await expect(page.locator("[data-home-root]")).toBeFocused();
});

test("takken concept deep links hydrate from a neutral static list", async ({ page, request }) => {
  const staticHtml = await (await request.get("/takken/glossary?concept=takken-term-001")).text();
  expect(staticHtml).toContain('aria-busy="true"');
  expect(staticHtml).not.toContain('class="glossary-entry"');

  await page.goto("/takken/glossary?concept=takken-term-001");
  await expect(page.getByRole("searchbox")).toHaveValue(/.+/);
  await expect(page.locator(".glossary-entry")).toHaveCount(1);
});
