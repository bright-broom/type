import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/privacy", "/takken", "/takken/glossary", "/takken/history", "/takken/mock", "/takken/practice"];

for (const route of ROUTES) {
  test(`${route} ships the enforced browser security boundary`, async ({ page }) => {
    const browserFailures: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserFailures.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserFailures.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "unknown";
      if (errorText === "net::ERR_ABORTED" && request.url().includes("_rsc=")) return;
      browserFailures.push(`requestfailed: ${request.url()} ${errorText}`);
    });
    const response = await page.goto(route);
    expect(response).not.toBeNull();
    const headers = response!.headers();

    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(headers["strict-transport-security"]).toBe("max-age=63072000");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("base-uri 'none'");
    expect(headers["content-security-policy"]).toContain("form-action 'none'");
    expect(headers["content-security-policy"]).toContain("script-src-attr 'none'");
    expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (route === "/") {
      await page.getByRole("button", { name: "表示設定" }).click();
      await expect(page.getByRole("heading", { name: "表示設定" })).toBeVisible();
    }
    expect(browserFailures).toEqual([]);
  });
}

test("the service worker update path is never intermediary-cached", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["cache-control"]).toContain("must-revalidate");
});

test("not-found responses preserve the security boundary", async ({ request }) => {
  const response = await request.get("/does-not-exist");
  expect(response.status()).toBe(404);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
