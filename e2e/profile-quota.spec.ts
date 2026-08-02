import { expect, test } from "@playwright/test";

test("profile list queries visible usage without preloading it", async ({ page }, testInfo) => {
  const preference = testInfo.project.name.endsWith("-dark") ? "dark" : "light";
  await page.addInitScript((value) => {
    localStorage.setItem("rcodexmanager-style", value);
    localStorage.setItem("rcodexmanager-language", "zh-CN");
  }, preference);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "rCodexManager" })).toBeVisible();
  await expect(page.locator(".product-brand-subtitle")).toHaveText("Codex Profile 工作台");
  await expect(page.locator(".product-brand-mark img")).toHaveAttribute(
    "src",
    "/rcodexmanager.png",
  );

  const quotaCells = page.locator(".profile-quota-cell");
  await expect(quotaCells.first()).toContainText("未查询");

  await page.getByRole("button", { name: "查询当前列表额度" }).click();
  await expect(page.locator(".profile-quota-values").first()).toContainText("5h");
  await expect(page.locator(".profile-quota-values").first()).toContainText("62%");
  await expect(page.locator(".profile-quota-values").first()).toContainText("7d");
  await expect(page.locator(".profile-quota-values").first()).toContainText("29%");

  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-profile-quota.png`,
    animations: "disabled",
  });

  const profileGrid = page.locator(".profile-grid");
  await profileGrid.evaluate((element) => {
    element.scrollTop = 180;
  });

  const profileHeader = page.locator(".profile-list-header");
  await expect(profileHeader).toBeVisible();
  const headerBackground = await profileHeader.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  expect(headerBackground).not.toMatch(/rgba\([^)]*,\s*0(?:\.0+)?\)$/);

  await page.screenshot({
    path: `test-results/playwright/${testInfo.project.name}-profile-quota-scrolled.png`,
    animations: "disabled",
  });
});
