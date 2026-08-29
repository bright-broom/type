import { expect, test, type Page } from "@playwright/test";

const PHONE = { width: 390, height: 844 };
const MINIMUM_TEXT_PX = 11;
// A hosted runner cannot make a deterministic 200 ms end-to-end latency promise:
// Event Timing includes input queueing and the next presentation opportunity.
// Keep a broad regression ceiling for that environment-owned signal, while the
// tighter processing budget isolates work that TypeLoop actually owns.
const CI_INTERACTION_LATENCY_CEILING_MS = 500;
const INTERACTION_PROCESSING_BUDGET_MS = 100;

async function hasOnlyThemeColor(page: Page, expected: string) {
  return page
    .locator('meta[name="theme-color"]')
    .evaluateAll(
      (elements, color) =>
        elements.length > 0 && elements.every((element) => element.getAttribute("content") === color),
      expected,
    );
}

async function undersizedVisibleText(page: Page) {
  return page.evaluate(
    (minimum) =>
      [...document.querySelectorAll("main *")]
        .filter((element) =>
          [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
        )
        .map((element) => ({
          element,
          box: element.getBoundingClientRect(),
          style: getComputedStyle(element),
        }))
        .filter(
          ({ element, box, style }) =>
            element.getAttribute("aria-hidden") !== "true" &&
            box.width >= 2 &&
            box.height >= 2 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number.parseFloat(style.fontSize) < minimum,
        )
        .map(
          ({ element, style }) =>
            `${element.tagName.toLowerCase()}.${element.className} ${Number.parseFloat(style.fontSize).toFixed(2)}px ${element.textContent?.trim().slice(0, 40)}`,
        ),
    MINIMUM_TEXT_PX,
  );
}

const readingSurfaces = [
  { name: "home", open: async (page: Page) => page.goto("/") },
  {
    name: "settings",
    open: async (page: Page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "表示設定" }).click();
    },
  },
  {
    name: "consulting dictionary",
    open: async (page: Page) => {
      await page.goto("/");
      await page.getByRole("button", { name: /コンサル実務辞典を開く/ }).click();
    },
  },
  { name: "takken dictionary", open: async (page: Page) => page.goto("/takken/glossary") },
  { name: "takken practice", open: async (page: Page) => page.goto("/takken/practice") },
  { name: "takken history", open: async (page: Page) => page.goto("/takken/history") },
] as const;

for (const surface of readingSurfaces) {
  test(`${surface.name} keeps informative mobile text legible`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true });
    const page = await context.newPage();
    await surface.open(page);
    await expect(page.locator("main")).toBeVisible();
    expect(await undersizedVisibleText(page)).toEqual([]);
    await context.close();
  });
}

test("the install manifest exposes complete same-origin assets", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    display: string;
    start_url: string;
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
    shortcuts?: Array<{ name: string; url: string }>;
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.shortcuts).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: "宅建用語集", url: "/takken/glossary" })]),
  );
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
      expect.objectContaining({ src: "/icons/icon-maskable-512.png", purpose: "maskable" }),
    ]),
  );
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test("the installed static shell remains interactive from root and deep URLs offline", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Offline install semantics are gated once in Chromium; WebKit remains in UI E2E.",
  );
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const expectedOfflinePrefetch =
      request.url().includes("_rsc=") &&
      request.headers()["next-router-prefetch"] === "1" &&
      (failure.includes("ERR_INTERNET_DISCONNECTED") || failure.includes("ERR_ABORTED"));
    if (!expectedOfflinePrefetch) failedRequests.push(`${failure} ${request.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => caches.keys().then((keys) => keys.some((key) => key.startsWith("typeloop-shell-")))),
    )
    .toBe(true);

  await page.getByRole("button", { name: "表示設定" }).click();
  await page.getByRole("radio", { name: /テーマ：\s*ライト/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "modern");
  await expect.poll(() => hasOnlyThemeColor(page, "#f5f3ed")).toBe(true);
  await page.getByRole("button", { name: /戻る/ }).click();
  await expect(page).toHaveURL(/\/$/);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "modern");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await expect.poll(() => hasOnlyThemeColor(page, "#f5f3ed")).toBe(true);
    await expect(page.getByRole("heading", { name: /60秒で、.*昨日より軽く。/ })).toBeVisible();
    await page.getByRole("button", { name: /60秒練習する/ }).click();
    await expect(page.locator(".countdown-shell")).toBeVisible();

    await page.goto("/takken/glossary?concept=takken-term-001", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "宅建試験 完全用語一覧" })).toBeVisible();
    await expect(page.locator(".glossary-entry")).toHaveCount(1);
    await page.getByRole("button", { name: /ホームへ/ }).click();
    await expect(page).toHaveURL(/\/takken$/);
    await expect(page.getByRole("heading", { name: /覚える。解く。/ })).toBeVisible();

    await page.goto("/takken/glossary?concept=takken-term-001", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "用語を練習" }).click();
    await expect(page).toHaveURL(/\/?training=takken$/);
    await expect(page.getByRole("radio", { name: /宅建/ })).toBeChecked();
  } finally {
    await context.setOffline(false);
  }
  expect(
    browserErrors.filter((message) => message !== "Failed to load resource: net::ERR_INTERNET_DISCONNECTED"),
  ).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test("@performance home meets lab paint, stability, and single-interaction latency budgets", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chromium exposes the standardized paint and event timing entries used here.");
  await page.addInitScript(() => {
    const state = {
      cls: 0,
      lcp: 0,
      interactionLatency: 0,
      interactionProcessing: 0,
      observedInteractions: 0,
      eventTimingSupported: PerformanceObserver.supportedEntryTypes.includes("event"),
    };
    const interactions = new Set<number>();
    Object.assign(globalThis, { __typeLoopVitals: state });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    if (state.eventTimingSupported) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { interactionId?: number; processingStart?: number; processingEnd?: number }
        >) {
          if (entry.name !== "click" || (entry.interactionId ?? 0) <= 0) continue;
          interactions.add(entry.interactionId ?? 0);
          state.observedInteractions = interactions.size;
          state.interactionLatency = Math.max(state.interactionLatency, entry.duration);
          state.interactionProcessing = Math.max(
            state.interactionProcessing,
            (entry.processingEnd ?? 0) - (entry.processingStart ?? 0),
          );
        }
      }).observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit & { durationThreshold: number });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "表示設定" }).click();
  await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __typeLoopVitals: { observedInteractions: number };
            }
          ).__typeLoopVitals.observedInteractions,
      ),
    )
    .toBeGreaterThan(0);
  const vitals = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __typeLoopVitals: {
            cls: number;
            lcp: number;
            interactionLatency: number;
            interactionProcessing: number;
            observedInteractions: number;
            eventTimingSupported: boolean;
          };
        }
      ).__typeLoopVitals,
  );
  expect(vitals.eventTimingSupported).toBe(true);
  expect(vitals.lcp).toBeGreaterThan(0);
  expect(vitals.lcp).toBeLessThanOrEqual(2_500);
  expect(vitals.cls).toBeLessThanOrEqual(0.1);
  expect(vitals.observedInteractions).toBeGreaterThan(0);
  expect(vitals.interactionLatency).toBeGreaterThan(0);
  expect(vitals.interactionLatency).toBeLessThanOrEqual(CI_INTERACTION_LATENCY_CEILING_MS);
  expect(vitals.interactionProcessing).toBeGreaterThan(0);
  expect(vitals.interactionProcessing).toBeLessThanOrEqual(INTERACTION_PROCESSING_BUDGET_MS);
});
