import { expect, test } from "@playwright/test";
import { expectNoPageFailures, observePageFailures } from "./support/browser-health.ts";

test("a corrupt session is isolated without hiding valid local history", async ({ page }) => {
  const validSession = {
    id: "valid-session",
    mode: "60s",
    trainingSet: "japanese",
    startedAt: 1_699_999_940_000,
    endedAt: 1_700_000_000_000,
    prompts: [
      {
        promptId: "basic-1",
        startedAt: 1_699_999_940_000,
        input: "sensitive-typed-text",
        correctKeystrokes: 1,
        incorrectKeystrokes: 0,
      },
    ],
    keystrokes: [
      {
        timestamp: 1_699_999_940_001,
        key: "s",
        normalizedKey: "s",
        correct: true,
        promptId: "basic-1",
        position: 0,
      },
    ],
    metrics: {
      correctKeystrokes: 100,
      totalKeystrokes: 105,
      accuracy: 95.2,
      wpm: 20,
      cpm: 100,
      elapsedMs: 60_000,
    },
    score: 1_200,
    completedPrompts: 3,
    maxCombo: 30,
    weakKeys: [],
  };
  await page.addInitScript((session) => {
    localStorage.setItem(
      "typeloop:data",
      JSON.stringify({
        version: 1,
        sessions: [
          { id: "corrupt-session", score: 10, endedAt: 1 },
          { ...session, id: "invalid-date-session", endedAt: 1e300 },
          session,
        ],
        settings: { soundEnabled: true },
      }),
    );
  }, validSession);
  const failures = observePageFailures(page);

  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "練習の記録" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "20", exact: true })).toBeVisible();
  await expect(page.getByText("直近 1 セッションを表示")).toBeVisible();
  const persisted = await page.evaluate(() => localStorage.getItem("typeloop:data"));
  expect(persisted).not.toContain("sensitive-typed-text");
  expect(JSON.parse(persisted ?? "{}").version).toBe(2);
  await expectNoPageFailures(failures);
});
