import { expect, type Page } from "@playwright/test";

export type PageFailureLog = string[];

export function observePageFailures(page: Page): PageFailureLog {
  const failures: PageFailureLog = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "unknown";
    if (!reason.includes("ERR_ABORTED")) failures.push(`request: ${request.url()} (${reason})`);
  });
  return failures;
}

export async function expectNoPageFailures(failures: PageFailureLog): Promise<void> {
  // Let errors raised by the last interaction reach Playwright's event queue.
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(failures).toEqual([]);
}
