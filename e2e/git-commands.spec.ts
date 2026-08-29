import { expect, test } from "@playwright/test";

test("Git mode starts a directly typable command session", async ({ page }) => {
  await page.goto("/");
  const gitMode = page.getByRole("radio", { name: /Git/ });
  await page.locator("label[data-mode-option]").filter({ hasText: "Git" }).click();
  await expect(gitMode).toBeChecked();
  await page.getByRole("button", { name: /60秒練習する/ }).click();

  await expect(page.locator(".prompt-reading")).toHaveText("GIT COMMAND");
  const command = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  expect(command).toMatch(/^(?:git [a-z0-9-]+|gitk|gitweb|scalar)$/);
  await expect(page.locator(".roman-line")).toHaveAttribute("aria-label", `入力: ${command}`);
  await page.keyboard.type(command?.[0] ?? "g");
  await expect(page.locator(".roman-typed")).not.toHaveText("");
});
